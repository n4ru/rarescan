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
    getAuctions: async (region, realm, faction) => {
        return (await fetch(`https://${region}.${base}/connected-realm/${realm}/auctions/${faction}?namespace=dynamic-classic-${region}&locale=en_US&access_token=${token}`)).json();
    },
    getHouses: async (region, realm) => {
        return (await fetch(`https://${region}.${base}/connected-realm/${realm}/auctions/index?namespace=dynamic-classic-${region}&locale=en_US&access_token=${token}`)).json();
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
        name: { type: DataTypes.TEXT },
        seed: { type: DataTypes.INTEGER.UNSIGNED },
        expiration: { type: Sequelize.TEXT },
        bid: { type: DataTypes.INTEGER.UNSIGNED },
        buyout: { type: DataTypes.INTEGER.UNSIGNED },
        qty: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
        realm: { type: DataTypes.INTEGER },
        region: { type: DataTypes.TEXT },
        faction: { type: DataTypes.TEXT },
    });
    itemsTable = seq.define('items', {
        id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, primaryKey: true },
        name: { type: DataTypes.TEXT }
        //rand: { type: DataTypes.INTEGER },
        //lastseen: { type: DataTypes.INTEGER }, // unique id from auctions table
    });
    randsTable = seq.define('rands', {
        id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, primaryKey: true },
        name: { type: DataTypes.TEXT },
        ench1: { type: DataTypes.INTEGER },
        ench2: { type: DataTypes.INTEGER },
        ench3: { type: DataTypes.INTEGER }
    });
    enchsTable = seq.define('enchs', {
        id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, primaryKey: true },
        name: { type: DataTypes.TEXT }
    });

    await auctionTable.sync(); // Sync models to database

    // We populate these from file each start
    await itemsTable.sync({ force: true });
    await randsTable.sync({ force: true });
    await enchsTable.sync({ force: true });

    // Import item data from items.json
    let items = require('../data/items.json')
    items = Object.keys(items).map(key => { return { id: key, name: items[key] } });
    await itemsTable.bulkCreate(items, { validate: true });

    // Import enchantment data from enchs.json
    let enchs = require('../data/enchs.json')
    enchs = Object.keys(enchs).map(key => { return { id: key, name: enchs[key] } });
    await enchsTable.bulkCreate(enchs, { validate: true });

    // Import rands data from rands.json
    let rands = require('../data/rands.json')
    rands = Object.keys(rands).map(key => {
        return {
            id: key,
            name: rands[key]['name'],
            ench1: rands[key]['ench1'],
            ench2: rands[key]['ench2'],
            ench3: rands[key]['ench3']
        }
    });
    await randsTable.bulkCreate(rands, { validate: true });

    console.log('Base data imported successfully.');
}

const update = async () => {


    for (idx in regions) { // Iterate regions
        let region = regions[idx];
        config.realms[region] = {};
        const realms = await api.getRealms(region);

        // Populate Config First
        for (idx in realms.results) {
            realm = realms.results[idx].data.realms[0];
            config.realms[region][realm.id] = { id: realm.id, slug: realm.slug, name: realm.name.en_US };
        }
    }

    // check if last scan was at least an hour ago
    if (config.lastscan && config.lastscan + 3600000 > Date.now()) return;

    config.lastscan = Date.now();

    // Update auction data
    for (idx in regions) { // Iterate regions
        let region = regions[idx];
        const realms = await api.getRealms(region);

        for (idx in realms.results) { // Iterate realms
            realm = realms.results[idx].data.realms[0];

            const factions = (await api.getHouses(region, realm.id)).auctions;
            for (idx in factions) { // Iterate factions
                let faction = factions[idx].id;
                let factionName =
                    factions[idx].name.includes('Horde') ? 'Horde'
                        : factions[idx].name.includes('Alliance') ? 'Alliance'
                            : 'Neutral'
                let auctions = (await api.getAuctions(region, realm.id, faction));
                auctions = (typeof auctions.auctions !== "undefined" ? auctions.auctions : []);
                console.log(`Processing ${auctions.length} auctions for ${realm.name.en_US} (${factionName})`);
                const allAuctions = [];
                for (idx in auctions) { // Iterate auctions
                    let auction = auctions[idx];
                    let item = await itemsTable.findOne({ where: { id: auction.item.id }, raw: true });
                    let suffix;
                    if (auction.item.rand) suffix = await randsTable.findOne({ where: { id: auction.item.rand }, raw: true });
                    allAuctions.push({
                        auction_id: auction.id,
                        item_id: auction.item.id,
                        rand_id: auction.item.rand || null,
                        ench_id: auction.item.ench || null,
                        name: item.name + (suffix ? ' ' + suffix.name : ''),
                        seed: auction.item.seed || null,
                        expiration: auction.time_left,
                        bid: auction.bid,
                        buyout: auction.buyout,
                        qty: auction.quantity,
                        realm: realm.id,
                        region: region,
                        faction: factionName
                    })
                }

                // Delete old auctions for this realm/faction
                await auctionTable.destroy({ where: { realm: realm.id, region: region, faction: factionName } });

                // Push auction data to database
                await auctionTable.bulkCreate(allAuctions, { validate: true });
            }

        }
    }
    
    console.log(`Done!`);
}

const main = async () => {

    await setup();
    await update();

    // Repeat setup every hour
    setInterval(async () => { await update() }, 3600000);

}

main();