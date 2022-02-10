const mongodb = require("mongodb");

const cl = console.log;

const URL = process.env.MONGOURL ? process.env.MONGOURL : 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME ? process.env.DB_NAME : "datastackConfig";

const USERS_TO_REMOVE = [];

function header(_s) {
	let width = process.stdout.columns;
	let line = '';
	while (width > 0) {
		line += '¯';
		width--;
	}
	console.log(line);
	let totalWidth = 32;
	let fitLength = _s.length;
	if (_s.length % 2 != 0) {
		fitLength += 1;
		_s += " ";
	}
	let sideWidth = (totalWidth - fitLength) / 2;
	var middle = "";
	i = 0;
	while (i < fitLength) {
		middle += "─"
		i++;
	};
	let liner = "";
	let spacer = "";
	i = 0;
	while (i < sideWidth) {
		liner += "─";
		spacer += " ";
		i++;
	}
	var top = "┌" + liner + middle + liner + "┐";
	var bottom = "└" + liner + middle + liner + "┘";
	var center = "│" + spacer + _s + spacer + "│";
	console.log(top)
	console.log(center)
	console.log(bottom)
};

async function parseUpdateResponse(collection, id, response) {
	if (response.matchedCount == 0) {
		cl(`No matching documents found under ${collection} for ${id}`);
		return;
	}
	if (response.modifiedCount == 0) {
		cl(`No documents updated under ${collection} for ${id}`);
		return;
	}
	cl(`Collection ${collection} -> Document updated for ${id}`);

}

async function deactivateUser(db) {
	cl(`Collection: userMgmt.users`);
	return await USERS_TO_REMOVE.reduce(async (_p, _user) => {
		await _p;
		let response = await db.collection("userMgmt.users")
			.updateOne({ _id: _user }, { "$set": { isActive: false } });
		return parseUpdateResponse("userMgmt.users", _user, response);
	}, Promise.resolve())
}

async function fixGroups(db) {
	cl(`Collection: userMgmt.groups`);
	let groups = await db.collection("userMgmt.groups")
		.find({})
		.project({ "name": 1, "users": 1, "app": 1 }).toArray()
	return await groups.reduce(async (_p, d) => {
		let length_prev = d.users.length;
		USERS_TO_REMOVE.forEach(user => {
			let userIndex = d.users.indexOf(user);
			if (userIndex != -1) d.users.splice(userIndex, 1);
		});
		let length_curr = d.users.length;
		if (length_curr < length_prev) {
			cl(d._id, length_curr, length_prev, d.app, d.name)
			let response = await db.collection("userMgmt.groups").updateOne({ _id: d._id }, {
				"$set": {
					users: d.users
				}
			})
			parseUpdateResponse("userMgmt.groups", d._id, response)
			console.log(`Updated : ${d._id}`);
		}
	}, Promise.resolve())
}

async function removePreferences(db) {
	cl(`Collection: userMgmt.preferences`)
	return await USERS_TO_REMOVE.reduce(async (prev, user) => {
		await prev;
		let response = await db.collection("userMgmt.preferences").deleteMany({ userId: user });
		if (response.deletedCount == 0) cl(`No preferences where cleared under userMgmt.preferences for ${user}`)
		else cl(`Collection userMgmt.preferences -> preferences cleaned up for ${user} : ${response.deletedCount}`)
	}, Promise.resolve());
}

(async () => {
	let client = new mongodb.MongoClient(URL, { useUnifiedTopology: true });

	await client.connect();
	cl("Connected to MongoDB");

	const db = client.db(DB_NAME);
	cl(`DB : ${DB_NAME}`);

	header("Deactivate users");
	await deactivateUser(db);

	header("Fix groups");
	await fixGroups(db);

	header("Remove preferences");
	await removePreferences(db);

	await client.close()
})()