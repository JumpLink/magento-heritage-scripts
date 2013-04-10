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

	int stock_vwheritage_qty;
	int stock_strichweg_qty;

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

	public void import_quantity_from_heritage_to_magento () {
		bool flawless = true;
		GLib.ValueArray magento_attributes = new GLib.ValueArray(2);
		magento_attributes.append("stock_strichweg_qty");
		int MAX = 200;
		string[] skus = heritage_api.catalog_product_list_skus ();
		
		Heritage.API.each_sum(skus, MAX, (part_array) => {
			GLib.HashTable<string, int64?> current_heritage_products = heritage_api.catalog_product_infos_qty (part_array);
			current_heritage_products.for_each ((heritage_sku, heritage_qty) => { 
				GLib.HashTable<string,Value?> current_magento_product = magento_api.catalog_product_info (heritage_sku, "", magento_attributes, "sku");
				int magento_qty = 0;
				current_magento_product.for_each ((key, val) => {
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
				GLib.HashTable<string,Value?> productData = Soup.value_hash_new ();
				productData.insert("stock_vwheritage_qty", heritage_qty.to_string());
				productData.insert("stock_strichweg_qty", magento_qty.to_string());
				GLib.HashTable<string,Value?> stock_data = Soup.value_hash_new ();
				stock_data.insert("qty", (heritage_qty + magento_qty).to_string() );
				productData.insert("stock_data", stock_data);

				string storeView = "";
				string identifierType = "sku";
				string productId = heritage_sku;

				if(magento_api.catalog_product_update (productId, productData, storeView, identifierType))
					print (@"Saved sku: $productId \theritage_qty: $heritage_qty \tmagento_qty: $magento_qty \tsum: $(heritage_qty+magento_qty) \n");
				else
					warning ("Storage unsuccessful: $productId \theritage_qty: $heritage_qty \tmagento_qty: $magento_qty \tsum: $(heritage_qty+magento_qty) \n");
			});
		});
	}

	public static int main (string[] args) {
		MagentoHeritageSync app = new MagentoHeritageSync ();
		app.import_quantity_from_heritage_to_magento ();
		return 0;
	}
}