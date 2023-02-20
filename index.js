import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();
let LIPSEY_TOKEN = getLipseyAuthToken();
let GUNBROKER_TOKEN = getGunBrokerAccessToken();

function getLipseyAuthToken(){
  const login_credentials = { "Email": process.env.LIPSEY_EMAIL, "Password": process.env.LIPSEY_PASSWORD };
  axios.post('https://api.lipseys.com/api/Integration/Authentication/Login', login_credentials,{
    headers: {
      'Content-Type': 'application/json'
    },
  })
  .then(function (response) {
    return response.data.token;
  })
  .catch(function (error) {
    console.log(error);
  });
}

function queryInventory(token){
  axios.get('https://api.lipseys.com/api/Integration/Items/CatalogFeed', {
  headers: {
    Token: token
  },
  })
  .then(function (response) {
    //console.log(response.data.data);
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
      filtered.push(item.description1);
    }
  });
  postOnGunBroker(filtered[0]);
}

function getGunBrokerAccessToken(){
  const gunbroker_credentials = { "Username": process.env.GUNBROKER_USERNAME, "Password": process.env.GUNBROKER_PASSWORD };
  axios.post('https://api.sandbox.gunbroker.com/v1/Users/AccessToken', gunbroker_credentials,{
  headers: {
    'Content-Type': 'application/json',
    'X-DevKey': process.env.GUNBROKER_DEVKEY
  },
  })
  .then(function (response) {
    return response.data.accessToken;
  })
  .catch(function (error) {
    console.log(error);
  });
}

function postOnGunBroker(item){
  axios.post('https://api.sandbox.gunbroker.com/v1/Items', gunbroker_credentials,{
  headers: {
    'Content-Type': 'application/json',
    'X-DevKey': process.env.GUNBROKER_DEVKEY,
    'X-AccessToken': GUNBROKER_TOKEN
  },
  })
  .then(function (response) {
    return response.data.accessToken;
  })
  .catch(function (error) {
    console.log(error);
  });
}