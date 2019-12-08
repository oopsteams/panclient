const { ipcRenderer } = require('electron');
module.exports = {
	quit:() => {
		console.log('to quit!');
		ipcRenderer.send('asynchronous-message', {'tag':'quit'});
	}
}