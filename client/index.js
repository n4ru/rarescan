let input = document.getElementById('search');
let host = "http://localhost:8081/search?name=";
let typingInterval = 1000;
let timer;

input.addEventListener('keypress', async () => {
    clearInterval(timer);
    timer = setTimeout(doneTyping, typingInterval)
})

let expirations = {
    "VERY_LONG": "12-48hrs",
    "LONG": "2-12hrs",
    "MEDIUM": "30mins-2hrs",
    "SHORT": "<30mins"
}

let table = `<tr><th width="256px">Item</th><th width="64px">Bid</th><th width="64px">Buyout</th><th width="32px">Quantity</th><th width="128px">Realm</th><th width="128px">Expiration</th><th width="128px">Faction</th></tr>`

let addRow = (item, bid, buyout, qty, realm, region, expiration, faction) => {
    let row = document.createElement('tr');
    row.innerHTML =
        `<tr><td>${item}</td><td>${bid}</td><td>${buyout}</td><!--td>${qty}</td--><td>${realm}</td><!--td>${region}</td--><td>${expiration}</td><td>${faction}</td></tr>`;
    document.getElementById('results').appendChild(row);
}

let gold = (value) => {
    // Convert integer to WoW gold format
    let gold = Math.floor(value / 10000);
    let silver = Math.floor((value - (gold * 10000)) / 100);
    let copper = value - (gold * 10000) - (silver * 100);
    return `${gold}g`;
}

let doneTyping = async () => {
    // Search for the item
    let search = input.value;
    let results = (await fetch(host + search));
    let auctions = (await results);
    auctions = (await auctions.json()).auctions;
    // Iterate over the results and populate the table
    let table = document.getElementById('results');
    table.innerHTML = "";
    if (auctions.length > 0) addRow('Item', 'Bid', 'Buyout', 'Quantity', 'Realm', 'Region', 'Expiration', 'Faction');
    auctions.forEach(auction => {
        let bid = auction.bid.toString();
        let buy = auction.buyout.toString();
        addRow(
            `<a href="https://wotlk.wowhead.com/item=${auction.item}" data-wowhead="rand=${auction.rand}">${auction.name}</a>`,
            gold(auction.bid),
            gold(auction.buyout),
            auction.qty,
            auction.realm,
            auction.region.toUpperCase(),
            expirations[auction.expiration],
            auction.faction);
    });
}