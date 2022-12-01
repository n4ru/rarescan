
const express = require('express');
const app = express();
const cors = require('cors');
const { Sequelize, Model, DataTypes } = require('sequelize');
const seq = new Sequelize({ dialect: 'sqlite', storage: 'db.sqlite', logging: false });const fluidb = require('fluidb');
const config = new fluidb('../config');
const { regions, base, token } = config;

let auctionTable, itemsTable, randsTable;

const router = async (port) => {

    await seq.authenticate(); // Test connection
    console.log('Connection has been established successfully. ');
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

    app.get('/search', cors(), async (req, res) => {
        let search = req.query.name;
        let results = await auctionTable.findAll({ where: { name: search }, raw: true });
        results = results.map(item => {
            return {
                item: item.item_id,
                rand: item.rand_id,
                name: item.name,
                bid: item.bid,
                buyout: item.buyout,
                qty: item.qty,
                realm: config.realms[item.region][item.realm].name,
                expiration: item.expiration,
                faction: item.faction,
                region: item.region
            }
        })
        .sort((a, b) => { return a.buyout - b.buyout });
        res.json({ auctions: results });
    });

    app.listen(port, () => {
        console.log(`API listening on ${port}`);
    });
}

router(8081);