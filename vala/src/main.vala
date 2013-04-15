/*
 * make
 * 
 * G_MESSAGES_DEBUG=all magento
 */

using Magento;
using Heritage;
using Soup;

public class MagentoHeritageSync : GLib.Object {

	Magento.API magento_api;
	Heritage.API heritage_api;

	Gee.HashSet<string> magento_skus;
	Gee.HashSet<string> heritage_skus;
	Gee.HashSet<string> syncable_skus;
	Gee.HashSet<string> only_heritage_skus;
	Gee.HashSet<string> only_magento_skus;

	public MagentoHeritageSync () {
		
		// Magento with config
		Magento.Config magento_config = Magento.Config();
		GLib.Settings settings = new GLib.Settings ("org.jumplink.magento");
		magento_config.host = settings.get_string("host");
		magento_config.port = settings.get_int("port");
		magento_config.path = settings.get_string("path");
		magento_config.user = settings.get_string("user");
		magento_config.key = settings.get_string("key");
		magento_api = new Magento.API(magento_config);

		// Heritage with config
		Heritage.Config heritage_config = Heritage.Config();
		settings = new GLib.Settings ("org.jumplink.vwheritage");
		heritage_config.host = settings.get_string("host");
		heritage_config.path = settings.get_string("path");
		heritage_config.key = settings.get_string("key");
		heritage_api = new Heritage.API(heritage_config);

	}

	/**
	 *	Diese Methode aktualisiert den Lagerbestand (Stock) von Magento. 
	 */
	private bool update_stock_on_magento (string sku, int64 heritage_qty, int64 magento_qty, int64 heritage_dueweeks, int64 heritage_availabilitymessagecode ) {
		int64 total_qty = heritage_qty + magento_qty;
		int is_in_stock = (total_qty > 0) ? 1 : 0;

		switch (heritage_availabilitymessagecode) {
			case 1: // "Not currently available"
				heritage_availabilitymessagecode = 45;
			break;
			case 2: // "Available soon, date to be confirmed"
				heritage_availabilitymessagecode = 46;
			break;
			case 3: // "Due in one week"
				heritage_availabilitymessagecode = 47;
			break;
			case 4: // "Available in [dueWeeks] weeks"
				heritage_availabilitymessagecode = 48;
			break;
		}

		GLib.HashTable<string,Value?> productData = Soup.value_hash_new ();
		productData.insert ( "stock_vwheritage_qty", (int) heritage_qty ) ;
		productData.insert ( "stock_vwheritage_dueweeks", (int) heritage_dueweeks );
		productData.insert ( "stock_vwheritage_messagecode", (int) heritage_availabilitymessagecode );
		productData.insert ( "stock_strichweg_qty", (int) magento_qty );
		productData.insert ( "delivery_time", "2-3" ); // Standard Lieferzeit

		GLib.HashTable<string,Value?> stock_data = Soup.value_hash_new ();
		stock_data.insert ( "qty", (int) total_qty );
		stock_data.insert ( "use_config_manage_stock", 1 ); // Warenbestand verwalten: OK Konfigurationseinstellungen verwenden
		stock_data.insert ( "is_in_stock", is_in_stock );
		productData.insert ( "stock_data", stock_data );

		string storeView = "";
		string identifierType = "sku";

		if(magento_api.catalog_product_update (sku, productData, storeView, identifierType)) {
			print (@"Saved: $sku \theritage_qty: $heritage_qty \tmagento_qty: $magento_qty \ttotal: $total_qty \t heritage_dueweeks: $heritage_dueweeks \t heritage_availabilitymessagecode: $heritage_availabilitymessagecode \n");
			return true;
		}
		else {
			warning (@"Storage unsuccessful: $sku \theritage_qty: $heritage_qty \tmagento_qty: $magento_qty \ttotal: $total_qty \n");
			return false;
		}
	}

	/**
	 *	Diese Methode beschafft sich alle Produkte von Heritage in 200er Schritten und importiert dessen Daten in Magento.
	 */
	public void import_each_heritage_quantity_to_magento () {
		bool flawless = true;
		GLib.ValueArray magento_attributes = new GLib.ValueArray(2);
		magento_attributes.append("stock_strichweg_qty");

		string[] good_skus = {};
		string[] bad_skus = {};
		
		Heritage.API.each_sum(syncable_skus.to_array (), 200, (part_array) => {
			Json.Object 	current_heritage_product_infos_root_object  = heritage_api.catalog_product_infos (part_array);
			int64 			current_heritage_product_infos_rowcount		= current_heritage_product_infos_root_object.get_int_member 	("ROWCOUNT");
			Json.Object 	current_heritage_product_infos_data			= current_heritage_product_infos_root_object.get_object_member 	("DATA");

			for (int i=0; i<current_heritage_product_infos_rowcount; i++) {
				string heritage_sku = current_heritage_product_infos_data.get_array_member ("ITEMNUMBER").get_string_element (i);
				int64 heritage_qty = current_heritage_product_infos_data.get_array_member ("FREESTOCKQUANTITY").get_int_element (i);
				int64 heritage_availabilitymessagecode = current_heritage_product_infos_data.get_array_member ("AVAILABILITYMESSAGECODE").get_int_element (i);
				int64 heritage_dueweeks = current_heritage_product_infos_data.get_array_member ("DUEWEEKS").get_int_element (i);

				GLib.HashTable<string,Value?> current_magento_product_attributes = magento_api.catalog_product_info (heritage_sku, "", magento_attributes, "sku");
				int magento_qty = 0;
				current_magento_product_attributes.for_each ((key, val) => {
					switch (key) {
						case "sku":
							if(heritage_sku != val.get_string())
								warning (@"skus do not match: $heritage_sku : "+val.get_string());
							break;
						case "stock_strichweg_qty":
							string tmp_str = "0";
							if ( val != null) {
								tmp_str = (string) val;
								if ( tmp_str != null && tmp_str != "" )
									magento_qty = int.parse ( tmp_str );
							}
							break;
						case "error":
							flawless = false;
							break;
					}
				});
				if (update_stock_on_magento(heritage_sku, heritage_qty, magento_qty, heritage_dueweeks, heritage_availabilitymessagecode))
					good_skus += heritage_sku;
				else
					bad_skus += heritage_sku;
			}
		});
		debug ("successful sku's: \n");
		foreach (string good_sku in good_skus) {
			debug (good_sku);
			debug ("\n");
		}
		debug ("faulty sku's: \n");
		foreach (string bad_sku in bad_skus) {
			debug (bad_sku);
			debug ("\n");
		}
	}

	public static Gee.HashSet<string> clone_string_set (Gee.HashSet<string> set) {
		Gee.HashSet<string> new_set = new Gee.HashSet<string> ();
		foreach (string sku in set) {
			new_set.add (sku);
		}
		return new_set;
	}

	/**
	 * 
	 */
	public void load_data () {
		magento_skus = magento_api.catalog_product_list_all_skus ();
		heritage_skus = heritage_api.catalog_product_list_all_skus ();

		// Schnittmenge aus magento_skus und heritage_skus
		syncable_skus = clone_string_set (magento_skus);
		syncable_skus.retain_all (heritage_skus); 

		// Differenzmenge von heritage_skus und magento_skus bzw. syncable_skus.
		only_heritage_skus = clone_string_set (heritage_skus);
		only_heritage_skus.remove_all (syncable_skus); 

		// Differenzmenge von magento_skus und heritage_skus bzw. syncable_skus.
		only_magento_skus = clone_string_set (magento_skus);
		only_magento_skus.remove_all (syncable_skus); 
	}

	/**
	 * 
	 */
	public void print_data () {
		debug ("Produkte die in beiden Shops vorhanden sind:\n");
		foreach (string sku in syncable_skus) {
			debug (sku+"\n");
		}

		print ("Produkte die nur in Heritage vorhanden sind:\n");
		foreach (string sku in only_heritage_skus) {
			print (sku+"\n");
		}

		print ("Produkte die nur in Magento vorhanden sind:\n");
		foreach (string sku in only_magento_skus) {
			print (sku+"\n");
		}
	}

	public static int main (string[] args) {
		MagentoHeritageSync app = new MagentoHeritageSync ();
		app.load_data ();
		app.import_each_heritage_quantity_to_magento ();
		app.print_data ();
		return 0;
	}
}