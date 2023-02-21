import axios from 'axios';
import * as dotenv from 'dotenv';
import descriptionGenerator from './descriptionGenerator.js';

dotenv.config();

let LipseyAuthToken = new Promise(function(resolve, reject){
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
  var lowestQuantityAllowed = 50;
  var filtered = [];
  dataset.map((item) => {
    if(item.quantity >= lowestQuantityAllowed){
      filtered.push(item);
    }
  });
  console.log(filtered[0]);
  postOnGunBroker(filtered[0]);
}

async function postOnGunBroker(item){

  // Data calculations and organizations
  var weight;
  if(item.weight == null){
    weight = 5.0;
  }else{
    weight = item.weight;
  }

  var title = item.manufacturer + " " + item.model + " " + item.caliberGauge + " " + item.capacity;

  // Prepare order
  var listingSettings = {
    AutoRelist: 1, // Do not relist
    CanOffer: false, 
    CategoryID: 3026, //[TODO] Need to find Category IDs
    Characteristics: {
      Manufacturer: item.manufacturer,
      Model: item.model,
      Caliber: item.caliberGauge,
    },
    Condition: 1,
    CountryCode: "US",
    Description: descriptionGenerator(item), // [TODO] Create description generator
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
    PictureURLs: ['https://seattleengravingcenter.com/wp-content/uploads/2022/12/colt-1911-comp-skull-flowers-2.jpg'],
    PremiumFeatures: {
      IsFeaturedItem: true,
      ThumbnailURL: "https://seattleengravingcenter.com/wp-content/uploads/2022/12/colt-1911-comp-skull-flowers-2.jpg",
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
    ShippingClassCosts: { Ground: 1.00 }, // [TODO] Calculate shipping cost based on product weight from Lipsey
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
  const data = new FormData();
  data.append("data", listingSettingsBlob);

  let token = await GunBrokerAccessToken;
  axios.post('https://api.sandbox.gunbroker.com/v1/Items', data, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'X-DevKey': process.env.GUNBROKER_DEVKEY,
      'X-AccessToken': token
    }
  })
  .then(function (response) {
    console.log(response);
  })
  .catch(function (error) {
    console.log(error.response.data);
  });
}

// RUN PROCESS

queryInventory();
