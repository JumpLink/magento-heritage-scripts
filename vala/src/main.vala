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

	MainLoop loop;

	public MagentoHeritageSync () {

		loop = new MainLoop();
		
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
	async bool update_stock_on_magento (string sku, int64 heritage_qty, int64 magento_qty, int64 heritage_dueweeks, int64 heritage_availabilitymessagecode ) {
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

	async GLib.HashTable<string,Value?> get_magento_product_info (string sku, GLib.ValueArray attributes)  {
		return magento_api.catalog_product_info (sku, "", attributes, "sku");
	}

	async Json.Object get_part_of_heritage_product_infos (string[] part_array)  {
		return heritage_api.catalog_product_infos (part_array);
	}

	/**
	 * Diese Methode beschafft sich alle Produkte von Heritage in 200er Schritten,
	 * diese 200 Artikel werden dann jeweils einzeln von Magento geladen und anschließend mit den neuen Daten wieder importiert.
	 */
	public bool import_each_heritage_quantity_to_magento_via_xmlrpc () {
		bool flawless = true;

		GLib.ValueArray magento_attributes = new GLib.ValueArray(2);
		magento_attributes.append("stock_strichweg_qty");
		
		Heritage.API.each_sum(syncable_skus.to_array (), 200, (part_array, heritage_part_index, heritage_part_length) => {
			print ("starte mit part %i/%i\n", heritage_part_index, heritage_part_length);
			//Json.Object 	current_heritage_product_infos_root_object  = heritage_api.catalog_product_infos (part_array);
			get_part_of_heritage_product_infos.begin (part_array, (obj, res) => {
				Json.Object	current_heritage_product_infos_root_object = get_part_of_heritage_product_infos.end (res);
			
				int64 			current_heritage_product_infos_rowcount		= current_heritage_product_infos_root_object.get_int_member 	("ROWCOUNT");
				Json.Object 	current_heritage_product_infos_data			= current_heritage_product_infos_root_object.get_object_member 	("DATA");

				for (int i=0; i<current_heritage_product_infos_rowcount; i++) {
					string heritage_sku = current_heritage_product_infos_data.get_array_member ("ITEMNUMBER").get_string_element (i);
					int index = i;
					//GLib.HashTable<string,Value?> current_magento_product_attributes = magento_api.catalog_product_info (heritage_sku, "", magento_attributes, "sku");
					this.get_magento_product_info.begin (heritage_sku, magento_attributes, (obj, res) => {
						GLib.HashTable<string,Value?> current_magento_product_attributes = get_magento_product_info.end(res);

						int64 heritage_qty = current_heritage_product_infos_data.get_array_member ("FREESTOCKQUANTITY").get_int_element (index);
						int64 heritage_availabilitymessagecode = current_heritage_product_infos_data.get_array_member ("AVAILABILITYMESSAGECODE").get_int_element (index);
						int64 heritage_dueweeks = current_heritage_product_infos_data.get_array_member ("DUEWEEKS").get_int_element (index);

						int magento_qty = 0;
						string magento_sku = "";
						current_magento_product_attributes.for_each ((key, val) => {
							switch (key) {
								case "sku":
									magento_sku = (string) val;
									if (magento_sku != heritage_sku)
										warning (@"$magento_sku != $heritage_sku");
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
						update_stock_on_magento.begin (magento_sku, heritage_qty, magento_qty, heritage_dueweeks, heritage_availabilitymessagecode, (obj, res) => {
							if( (index >= current_heritage_product_infos_rowcount-1) && (heritage_part_index >= heritage_part_length-1) )
								loop.quit();
						});
					});
				}
			});
		});
		loop.run ();
		return flawless;
	}

	public void start_dbus () {
		// Variable ist gesetzt?
		unowned string dbus_session_bus_address = GLib.Environment.get_variable ("DBUS_SESSION_BUS_ADDRESS");
		if (dbus_session_bus_address == null || dbus_session_bus_address == "" || dbus_session_bus_address.length < 3 ) {
			if(dbus_session_bus_address != null)
				print ("dbus_session_bus_address is %s\n", dbus_session_bus_address);
			else {
				print ("dbus_session_bus_address is null\n");
			}
			print ("starte dbus-launch\n");
			try {
				GLib.Process.spawn_command_line_async ("dbus-launch");
				print ("gestartet\n");
			} catch (SpawnError e) {
				warning ("Error: %s\n", e.message);
			}
		} else {
			debug ("dbus läuft bereits.\n"); 
		}
	}

	/**
	 * Wie import_each_heritage_quantity_to_magento_via_xmlrpc nur mithilfe von D-Bus
	 * @see import_each_heritage_quantity_to_magento_via_xmlrpc
	 */
	public bool import_each_heritage_quantity_to_magento_via_dbus () {
		//this.start_dbus ();
		bool flawless = true;
		ProductStock dbus_product_stock = null;
		try {
			dbus_product_stock = Bus.get_proxy_sync (BusType.SESSION, "org.jumplink.magento", "/org/jumplink/magento");
		} catch (IOError e) {
			error ("%s\n", e.message);
		}
		
		Heritage.API.each_sum(syncable_skus.to_array (), 200, (part_array, heritage_part_index, heritage_part_length) => {
			
			Json.Object	current_heritage_product_infos_root_object = heritage_api.catalog_product_infos (part_array);
		
			int64 			current_heritage_product_infos_rowcount		= current_heritage_product_infos_root_object.get_int_member 	("ROWCOUNT");
			Json.Object 	current_heritage_product_infos_data			= current_heritage_product_infos_root_object.get_object_member 	("DATA");

			print ("starte mit part %i/%i mit %i Artikeln \n", heritage_part_index, heritage_part_length, (int) current_heritage_product_infos_rowcount);

			for (int i=0; i<current_heritage_product_infos_rowcount; i++) {
				debug ("# %i\n", i);
				string heritage_sku = current_heritage_product_infos_data.get_array_member ("ITEMNUMBER").get_string_element (i);				
				
				debug ("heritage_sku: %s\n", heritage_sku);

				int magento_qty = 0;

				try {
					magento_qty = int.parse ( dbus_product_stock.get (heritage_sku) );
				} catch (IOError e) {
					warning ("%s\n", e.message);
					flawless = false;
				}

				debug ("magento_qty: %i\n", magento_qty);

				int heritage_qty = (int) current_heritage_product_infos_data.get_array_member ("FREESTOCKQUANTITY").get_int_element (i);
				int64 heritage_availabilitymessagecode = current_heritage_product_infos_data.get_array_member ("AVAILABILITYMESSAGECODE").get_int_element (i);
				int64 heritage_dueweeks = current_heritage_product_infos_data.get_array_member ("DUEWEEKS").get_int_element (i);

				debug ("heritage_qty: %i\n", heritage_qty);

				int total_qty = heritage_qty + magento_qty;
				int is_in_stock = (total_qty > 0) ? 1 : 0;

				debug ("total_qty: %i\n", total_qty);

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
					case 4: // "Available int [dueWeeks] weeks"
						heritage_availabilitymessagecode = 48;
					break;
				}

				debug ("heritage_availabilitymessagecode: %i\n", (int) heritage_availabilitymessagecode);

				try {
					dbus_product_stock.update (heritage_sku, magento_qty.to_string(), heritage_qty.to_string(), total_qty.to_string(), heritage_dueweeks.to_string(), heritage_availabilitymessagecode.to_string());
					print (@"Saved: $heritage_sku \theritage_qty: $heritage_qty \tmagento_qty: $magento_qty \ttotal: $total_qty \t heritage_dueweeks: $heritage_dueweeks \t heritage_availabilitymessagecode: $heritage_availabilitymessagecode \n");
				} catch (IOError e) {
					warning ("%s\n", e.message);
					flawless = false;
				}
			}
		});
	print ("fertig\n");
		return flawless;
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
		// app.read_and_transform_magento_csv ("./test.csv");
		// app.start_dbus ();
		app.load_data ();
		app.import_each_heritage_quantity_to_magento_via_dbus ();
		//app.print_data ();
		// Csv.Loader csv = new Csv.Loader();
		// csv.read ("./test.csv");
		// csv.parse (111, ',');
		// csv.print_lines ();
		return 0;
	}
}
