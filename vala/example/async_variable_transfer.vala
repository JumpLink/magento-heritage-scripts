async void async_method (int index, out int transfered_index)  {
	...
	transfered_index = index;
}
...
for (int i = 0; i<whatever;i++) {
	async_method.begin (i, (obj, res) => {
		int index;
		async_method.end(res, out index);
		print ("wrong index: %i", i);
		print ("right index: %i", index);
	});
}