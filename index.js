import axios from 'axios';
import fs from 'fs';
import * as dotenv from 'dotenv';
import descriptionGenerator from './descriptionGenerator.js';
import { downloadImage, editImage } from './imageGenerator.js';
import chalk from 'chalk';

dotenv.config();

export function logProcess(message, type){
  console.log("_________________________________________________________________________________");
  switch(type){
    case 'good':
      console.log(chalk.green(message));
      break;
      case 'bad':
        console.log(chalk.red(message));
        break;
      case 'warning':
        console.log(chalk.yellow(message));
        break;
      default:
        console.log(chalk.magenta(message));
  }
}

let LipseyAuthToken = new Promise(function(resolve, reject){
  logProcess("Getting Lipseys API token...");
  const login_credentials = { "Email": process.env.LIPSEY_EMAIL, "Password": process.env.LIPSEY_PASSWORD };
  axios.post('https://api.lipseys.com/api/Integration/Authentication/Login', login_credentials,{
    headers: {
      'Content-Type': 'application/json'
    },
  })
  .then(function (response) {
    resolve(response.data.token);
  })
  .catch(function (error) {
    reject(new Error(error));
  });
});

let GunBrokerAccessToken = new Promise(function(resolve,reject){
  logProcess("Getting Gunbroker access token...");
  const gunbroker_credentials = { "Username": process.env.GUNBROKER_USERNAME, "Password": process.env.GUNBROKER_PASSWORD };
  axios.post('https://api.sandbox.gunbroker.com/v1/Users/AccessToken', gunbroker_credentials,{
  headers: {
    'Content-Type': 'application/json',
    'X-DevKey': process.env.GUNBROKER_DEVKEY
  },
  })
  .then(function (response) {
    resolve(response.data.accessToken);
  })
  .catch(function (error) {
    reject(new Error(error));
  });
});

let currentUserID = new Promise( async (resolve, reject) => {
  let token = await GunBrokerAccessToken;
  axios.get('https://api.sandbox.gunbroker.com/v1/Users/AccountInfo',{
    headers: {
      'Content-Type': 'application/json',
      'X-DevKey': process.env.GUNBROKER_DEVKEY,
      'X-AccessToken': token
    },
  })
  .then(function (response) {
    resolve(response.data.userSummary.userID);
  })
  .catch(function (error) {
    reject(new Error(error));
  });
});

function checkAlreadyPosted(upc){
  return new Promise( async (resolve, reject) => {
    let userID = await currentUserID;
    let token = await GunBrokerAccessToken;
    axios.get('https://api.sandbox.gunbroker.com/v1/Items?IncludeSellers='+userID+'&UPC='+upc,{
      headers: {
        'Content-Type': 'application/json',
        'X-DevKey': process.env.GUNBROKER_DEVKEY,
        'X-AccessToken': token
      },
    })
    .then(function (response) {
      if(response.data.countReturned > 0){
        // Product Already Posted
        resolve(true);
      }else{
        resolve(false);
      }
    })
    .catch(function (error) {
      console.log(error);
      reject(new Error(error));
    });
  });
}

async function queryInventory(){
  
  let token = await LipseyAuthToken;
  logProcess("Retrieving Lipseys Inventory...");
  axios.get('https://api.lipseys.com/api/Integration/Items/CatalogFeed', {
  headers: {
    Token: token
  },
  })
  .then(function (response) {
    filterProducts(response.data.data);
  })
  .catch(function (error) {
    console.log(error);
  });
}

function filterProducts(dataset){
  logProcess("Filtering Results...");
  let lowestQuantityAllowed = 5;
  let typesAllowed = ['Semi-Auto Pistol','Rifle', 'Revolver', 'Shotgun'];
  let filtered = [];
  
  dataset.map( async (item) => {
    if(item.quantity >= lowestQuantityAllowed && typesAllowed.includes(item.type) && item.allocated == false && item.price > 150){
      filtered.push(item);
    }
  });
  logProcess(chalk.green.bold(filtered.length) + " products eligable to post (after filter)");
  postAllListings(filtered, 100);
}

function postOnGunBroker(item){
  return new Promise( async (resolve, reject) => {

    // Check if item is already posted
    let alreadyPosted = await checkAlreadyPosted(item.upc);
    if(alreadyPosted){
      logProcess("Item already posted", "warning");
      return;
    }

    // Generate and Edit Thumbnail
    let imgPath = await downloadImage("https://www.lipseyscloud.com/images/"+item.imageName, "tmp/tmp.jpeg");
    let thumbnailPath = await editImage(imgPath);
    let thumbnail = fs.readFileSync(thumbnailPath);
    let img1 = fs.readFileSync(imgPath);

    // Setting Quantity
    let quantity;

    if(item.quantity >= 20){ quantity = 5 } else
    if(item.quantity < 20){ quantity = 2 }
    else{ quantity = 0 };

    // Setting Price
    let price;

    let cost = item.price;
    let map = item.retailMap; // Map will be number, 0 if there is no map

    price = cost * 1.15; // set price to cost of gun plus 15% then round to 2 decimals
    price = (Math.round(price * 100) / 100).toFixed(2);

    if(price < map){ // if new price is lower than map, set price to map
      price = map;
    }

    logProcess("Price changed from $" + cost + " to $" + price);
    
    // Setting Category IDs and Shipping Prices
    let categoryID;
    let ShippingPrice = 30;

    switch(item.type) {
      case 'Semi-Auto Pistol':
        ShippingPrice = 29;
        categoryID = 3026;
        break;
      case 'Rifle':
        switch (item.action) {
          case 'Semi-Auto':
            categoryID = 3024;
            break;
          case 'Single Shot':
            categoryID = 3011;
            break;
          case 'Pump Action':
            categoryID = 3102;
            break;
          case 'Bolt Action':
            categoryID = 3022;
            break;
          case 'Lever Action':
            categoryID = 3023;
            break;
          default:
            categoryID = 3025;
        }
        break;
      case 'Revolver':
        categoryID = 2325;
        break;
      case 'Shotgun':
        switch (item.action) {
          case 'Semi-Auto':
            categoryID = 3105;
            break;
          case 'Side By Side':
            categoryID = 3104;
            break;
          case 'Over / Under':
            categoryID = 3103;
            break;
          case 'Pump Action':
            categoryID = 3106;
            break;
          default:
            categoryID = 3108;
        }
        break;
      default:
        categoryID = 3004;
    }

    var title = item.manufacturer + " " + item.model + " " + item.caliberGauge + " " + item.capacity + " | " + item.upc;
    title = Array.from(new Set(title.split(' '))).toString();
    title = title.replaceAll(",", " ");

    // Prepare order
    logProcess("Preparing listing data...");
    var listingSettings = {
      AutoRelist: 1, // Do not relist
      CanOffer: false, 
      CategoryID: categoryID,
      Characteristics: {
        Manufacturer: item.manufacturer,
        Model: item.model,
        Caliber: item.caliberGauge,
      },
      Condition: 1, // Factory New
      CountryCode: "US",
      Description: descriptionGenerator(item),
      FixedPrice: price,
      InspectionPeriod: 1, // Sales are final
      isFFLRequired: true,
      ListingDuration: 90, // List for 90 days
      MfgPartNumber: item.manufacturerModelNo,
      PaymentMethods: {
        Check: false,
        VisaMastercard: true,
        COD: false,
        Escrow: false,
        Amex: true,
        PayPal: false,
        Discover: true,
        SeeItemDesc: false,
        CertifiedCheck: false,
        USPSMoneyOrder: true,
        MoneyOrder: true,
        FreedomCoin: false
      },
      PaymentPlan: 0,
      PremiumFeatures: {
        IsFeaturedItem: true,
      },
      PostalCode: "33511",
      Prop65Warning: "Cancer and Reproductive Harm www.P65Warnings.ca.gov",
      Quantity: quantity,
      UseDefaultSalesTax: true,
      ShippingClassesSupported: {
        Overnight: false,
        TwoDay: false,
        ThreeDay: false,
        Ground: true,
        FirstClass: false,
        Priority: false,
        InStorePickup: false,
        AlaskaHawaii: false,
        Other: false
      },
      ShippingClassCosts: { Ground: ShippingPrice },
      StandardTextID: 1138,
      Title: title,
      UPC: item.upc,
      WhoPaysForShipping: 8,
      WillShipInternational: false
    };

    const listingSettingsJSON = JSON.stringify(listingSettings);
    const listingSettingsBlob = new Blob([listingSettingsJSON], {
      type: 'form-data',
    });
    const thumbnailBlob = new Blob([thumbnail], { name: "thumbnail", type: 'image/jpeg', 'Content-Disposition':'form-data' });
    const img1Blob = new Blob([thumbnail], { name: "picture", type: 'image/jpeg', 'Content-Disposition':'form-data' });
    const img2Blob = new Blob([img1], { name: "picture", type: 'image/jpeg', 'Content-Disposition':'form-data' });
    const data = new FormData();
    data.append("data", listingSettingsBlob);
    data.append("thumbnail", thumbnailBlob, 'thumbnail.jpeg');
    data.append("picture", img1Blob, 'picture1.jpeg');
    data.append("picture", img2Blob, 'picture2.jpeg');

    let token = await GunBrokerAccessToken;
    logProcess("Posting Item [" + item.upc + "] with title: "+title, 'warning');
    logProcess("Sending Listing to Gunbroker...");
    axios.post('https://api.sandbox.gunbroker.com/v1/Items', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-DevKey': process.env.GUNBROKER_DEVKEY,
        'X-AccessToken': token
      }
    })
    .then(function (response) {
      logProcess(response.data.userMessage);
      logProcess("Deleting temporarily stored images...");
      const TmpImagePath = 'tmp/tmp.jpeg';
      const CurrentImagePath = 'tmp/thumbnail.jpeg';
      try {
        if (fs.existsSync(TmpImagePath)) {
          fs.unlinkSync(TmpImagePath);
        }
        if (fs.existsSync(CurrentImagePath)) {
          fs.unlinkSync(CurrentImagePath);
        }
        logProcess(response.data.userMessage, 'good');
        resolve();
      } catch(err) {
        reject(new Error(err));
      }
    })
    .catch(function (error) {
      reject(new Error(error.response.data));
      console.log(error.response.data);
    });
  });
}

async function postAllListings(listings, limit){
  if(limit){
    listings = listings.slice(0, limit);
  }

  logProcess("Posting " + chalk.bold.green(listings.length) + " items on GunBroker.");

  for(let item of listings){
    await postOnGunBroker(item);
  }
}

// RUN PROCESS

queryInventory();