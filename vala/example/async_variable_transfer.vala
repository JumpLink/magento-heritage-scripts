public class BasicSample : Object {
	public async void async_method (int index, out int transfered_index)  {
		Posix.sleep (1);
		transfered_index = index;
	}
}



int main (string[] args) {
	var loop = new MainLoop ();
	var sample = new BasicSample ();
	for (int i = 0; i<10;i++) {
		int i_copy = i;
		sample.async_method.begin (i, (obj, res) => {
			int index;
			sample.async_method.end (res, out index);
			print ("wrong index: %i\n", i);
			print ("right index: %i\n", index);
			print ("right index: %i\n", i_copy);
			if (index >= 9)
				loop.quit ();
		});
	}
	loop.run ();
	return 0;
}

// valac --thread --pkg=gio-2.0 --pkg=posix async_variable_sample.vala
