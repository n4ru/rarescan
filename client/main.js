const fluidb = require('fluidb');
const config = new fluidb('../config');
const { Sequelize, Model, DataTypes } = require('sequelize');
const fs = require('fs');

const seq = new Sequelize({ dialect: 'sqlite', storage: 'db.sqlite', logging: false });

let auctionTable, itemsTable, randsTable;

const { regions, base, token } = config;
const api = {
    getRealms: async (region) => {
        return (await fetch(`https://${region}.${base}/search/connected-realm?namespace=dynamic-classic-${region}&orderby=id&status.type=UP&_page=1&access_token=${token}`)).json();
    },
    getAuctions: async (region, realm) => {
        return (await fetch(`https://${region}.${base}/connected-realm/${realm}/auctions/2?namespace=dynamic-classic-${region}&locale=en_US&access_token=${token}`)).json();
    }
}

const setup = async () => {
    await seq.authenticate(); // Test connection
    console.log('Connection has been established successfully. Importing base data...');
    auctionTable = seq.define('auctions', {
        auction_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        item_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        rand_id: { type: DataTypes.INTEGER },
        ench_id: { type: DataTypes.INTEGER },
        seed: { type: DataTypes.INTEGER.UNSIGNED },
        expiration: { type: Sequelize.TEXT },
        bid: { type: DataTypes.INTEGER.UNSIGNED },
        buyout: { type: DataTypes.INTEGER.UNSIGNED },
        qty: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        realm: { type: DataTypes.INTEGER },
    });
    itemsTable = seq.define('items', {
        id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, primaryKey: true },
        name: { type: DataTypes.TEXT },
        //rand: { type: DataTypes.INTEGER },
        //lastseen: { type: DataTypes.INTEGER }, // unique id from auctions table
    });
    randsTable = seq.define('rands', {
        id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, primaryKey: true },
        name: { type: DataTypes.TEXT },
    });
    auctionTable.sync({ force: true });
    itemsTable.sync({ force: true });
    randsTable.sync({ force: true });

    // Import item data from items.json
    let items = require('../data/items.json')
    items = Object.keys(items).map(key => { return { id: key, name: items[key] } });
    console.log(items[0]);
    await itemsTable.bulkCreate(items, { validate: true });

    // Import rands data from rands.json
    let rands = require('../data/rands.json')
    rands = Object.keys(rands).map(key => { return { id: key, name: rands[key] } });
    await randsTable.bulkCreate(rands, { validate: true });

    console.log('Base data imported successfully.');
}

const main = async () => {

    await setup();

    // Update auction data
    for (idx in regions) {
        let region = regions[idx];
        config.realms[region] = {};
        const realms = await api.getRealms(region);
        for (idx in realms.results) {
            realm = realms.results[idx].data.realms[0];
            config.realms[region][realm.slug] = { id: realm.id, name: realm.name.en_US, };
            const auctions = (await api.getAuctions(region, realm.id)).auctions;
            console.log(`Processing ${auctions.length} auctions for ${realm.name.en_US}`);
            const allAuctions = [];
            for (idx in auctions) {
                let auction = auctions[idx];
                allAuctions.push({
                    auction_id: auction.id,
                    item_id: auction.item.id,
                    rand_id: auction.item.rand || null,
                    ench_id: auction.item.ench || null,
                    seed: auction.item.seed || null,
                    expiration: auction.time_left,
                    bid: auction.bid,
                    buyout: auction.buyout,
                    qty: auction.quantity,
                    realm: realm.id,
                })
            }
            // Push realm data to database
            await auctionTable.bulkCreate(allAuctions, { validate: true });
            console.log(`Finished processing ${realm.name.en_US}`);
        }
    }
}

main();