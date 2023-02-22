import axios from 'axios';
import fs from 'fs';
import * as dotenv from 'dotenv';
import descriptionGenerator from './descriptionGenerator.js';
import { downloadImage, editImage } from './imageGenerator.js';

dotenv.config();

let firstLog = true;
export function logProcess(message){
  if(firstLog){
    console.log(message);
    firstLog = false;
  }else{
    console.log("_________________________________________________________________________________");
    console.log(message);
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

async function queryInventory(){
  
  let token = await LipseyAuthToken;
  logProcess("Retrieving Lipseys Inventory...");
  axios.get('https://api.lipseys.com/api/Integration/Items/CatalogFeed', {
  headers: {
    Token: token
  },
  })
  .then(function (response) {
    filterByQuantityAvailable(response.data.data);
  })
  .catch(function (error) {
    console.log(error);
  });
}

function filterByQuantityAvailable(dataset){
  logProcess("Filtering Results...");
  let lowestQuantityAllowed = 1;
  let typesAllowed = ['Semi-Auto Pistol','Rifle', 'Revolver', 'Shotgun'];
  let filtered = [];
  
  dataset.map((item) => {
    if(item.quantity >= lowestQuantityAllowed && typesAllowed.includes(item.type)){
      filtered.push(item);
      console.log(item.action);
    }
  });
  console.log(filtered[0]);
  //postOnGunBroker(filtered[20]);
}

async function postOnGunBroker(item){
  // Generate and Edit Thumbnail
  logProcess("Generating thumbnail image...");
  let imgPath = await downloadImage("https://www.lipseyscloud.com/images/"+item.imageName, "tmp/tmp.jpeg");
  console.log(imgPath);
  let editedImgPath = await editImage(imgPath);
  console.log(editedImgPath);
  let thumbnail = fs.readFileSync(editedImgPath);

  // Data calculations and organizations
  let weight;
  if(item.weight == null){
    weight = 5.0;
  }else{
    weight = item.weight;
    weight = weight.replace(" lbs.", "");
  }
  
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

  var title = item.manufacturer + " " + item.model + " " + item.caliberGauge + " " + item.capacity;

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
    Condition: 1,
    CountryCode: "US",
    Description: descriptionGenerator(item),
    FixedPrice: 1000, // [TODO] Calculate based on Lipsey Price
    InspectionPeriod: 1,
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
      ThumbnailURL: "current",
    },
    PostalCode: "33511",
    Prop65Warning: "Cancer and Reproductive Harm www.P65Warnings.ca.gov",
    Quantity: 1, // [TODO] Base quantity off of Lipsey in stock amount
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
    Weight: weight,
    WeightUnit: 1,
    WhoPaysForShipping: 8,
    WillShipInternational: false
  };

  const listingSettingsJSON = JSON.stringify(listingSettings);
  const listingSettingsBlob = new Blob([listingSettingsJSON], {
    type: 'form-data',
  });
  const thumbnailBlob = new Blob([thumbnail], { name: "thumbnail", type: 'image/jpeg', 'Content-Disposition':'form-data', filename:'thumbnail.jpeg' });
  const data = new FormData();
  data.append("data", listingSettingsBlob);
  data.append("thumbnail", thumbnailBlob);

  let token = await GunBrokerAccessToken;
  logProcess("Sending Listing to Gunbroker...");
  axios.post('https://api.sandbox.gunbroker.com/v1/Items', data, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'X-DevKey': process.env.GUNBROKER_DEVKEY,
      'X-AccessToken': token
    }
  })
  .then(function (response) {
    console.log(response);
    logProcess("Deleting temporarily stored images...");
    const TmpImagePath = 'tmp/tmp.jpeg';
    const CurrentImagePath = 'tmp/thumbnail.jpeg'
    try {
      fs.unlinkSync(TmpImagePath);
      fs.unlinkSync(CurrentImagePath);
    } catch(err) {
      console.error(err)
    }
  })
  .catch(function (error) {
    console.log(error.response.data);
  });
}

// RUN PROCESS

queryInventory();
