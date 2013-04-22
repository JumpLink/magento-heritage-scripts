.PHONY: magento-heritage-scripts clean

all: magento-heritage-scripts

magento-heritage-scripts:
	valac --pkg libsoup-2.4 --pkg gmodule-2.0 --pkg gee-1.0 --pkg gio-2.0 --pkg json-glib-1.0 --thread src/*.vala src/dependencies/magento/*.vala src/dependencies/heritage/*.vala src/dependencies/csv/*.vala -o magento-heritage-scripts

clean:
	rm -f ./magento-heritage-scripts ./core