'use strict'
const inquirer = require('inquirer');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'))
const SDK = require("@appveen/ds-sdk");
const log4js = require("log4js")
var logger = log4js.getLogger(`[repairServices]`);

function stringComparator(a, b) {
	let nameA = a.toUpperCase();
	let nameB = b.toUpperCase();
	if (nameA < nameB) return -1;
	if (nameA > nameB) return 1;
	return 0;
}


(async () => {
	try {
		let response = await inquirer.prompt([
			{
				type: 'input',
				name: 'host',
				message: "URL (without trialing /api)",
			},
			{
				type: 'input',
				name: 'username',
				message: "Username",
			},
			{
				type: 'password',
				name: 'password',
				message: "Password",
			}
		]);

		const dataStack = await SDK.authenticateByCredentials(response);
		const apps_raw = await dataStack.ListApps();
		let apps = apps_raw.map(app => app.app._id).sort(stringComparator)
		apps = ["*All*"].concat(apps);

		let selectedApp = await inquirer.prompt([{
			type: 'autocomplete',
			name: "app",
			message: "Select app",
			pageSize: 10,
			source: (_ans, _input) => {
				_input = _input || ''
				return apps.filter(_n => _n.toLowerCase().indexOf(_input.toLowerCase()) > -1)
			}
		}]);
		selectedApp = selectedApp.app
		if (selectedApp == "*All*") {
			apps.splice(0, 1)
		} else {
			apps = [selectedApp];
		}
		let queryParms = {
			select: "_id,name",
			filter: {
				status: "Active"
			}
		};
		await apps.reduce(async (_prev, app) => {
			let datastack_app = await dataStack.App(app);
			let dataServices = await datastack_app.ListDataServices(queryParms);
			dataServices = dataServices.map(ds => {
				console.log(ds.data._id, ds.data.name)
			})
			let status = await datastack_app.RepairAllDataServices({
				status: "Active"
			});
			console.log(status)
		}, Promise.resolve())

	} catch (error) {
		console.error(error)
	}
})();