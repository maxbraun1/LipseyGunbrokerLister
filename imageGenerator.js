import fs from 'fs';
import client from 'https';
import Jimp from 'jimp';
import { logProcess } from './index.js';

function downloadImage(url, filepath) {
    logProcess("Downloading Lipseys product image...");
    return new Promise((resolve, reject) => {
        client.get(url, (res) => {
            if (res.statusCode === 200) {
                res.pipe(fs.createWriteStream(filepath))
                    .on('error', (error) => {reject; console.log(error)})
                    .once('close', () => {
                        resolve(filepath);
                        logProcess("Lipseys product image saved.");
                    });
            } else {
                // Consume response data to free up memory
                res.resume();
                reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
                console.log("error");
            }
        });
    });
}

function editImage(path){
    return new Promise((resolve,reject) => {
        Jimp.read(path).then(async (image) => {
            // Add Text
            logProcess("Adding text to thumbnailw image...");
            const font = await Jimp.loadFont("./merriweather.fnt");
            const text = "NO CC FEE - SECGUNS.COM";
            let imgW = image.bitmap.width; //  width of the image
            let imgH = image.bitmap.height; // height of the image
            let textW = Jimp.measureText(font, text);
            let textPosX = imgW/2 - textW/2;
            image.print(font, textPosX, imgH-100, text);
            
            // Add border
            logProcess("Adding border to thumbnail image...");
            let borderWidth = imgW / 70;
            for(let x = 0; x < imgW; x++ ){
                for(let y = 0; y < imgH; y++ ){
                    if(x < borderWidth || x > imgW-borderWidth){
                        image.setPixelColor(0xFF0008FF, x, y);
                    }
                    if(y < borderWidth || y > imgH-borderWidth){
                        image.setPixelColor(0xFF0008FF, x, y);
                    }
                }
            }
    
            await image.writeAsync("tmp/thumbnail.jpeg");
            logProcess("Thumbnail image saved.");
        }).then(() => resolve("tmp/thumbnail.jpeg"));
    });
}

export {downloadImage, editImage};