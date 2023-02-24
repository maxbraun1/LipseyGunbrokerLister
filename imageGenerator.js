import fs from 'fs';
import client from 'https';
import sharp from 'sharp';
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
                        logProcess("Lipseys product image saved.", "good");
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
    logProcess("Generating thumbnail image...");
    return new Promise( async (resolve,reject) => {

        sharp.cache(false);

        let template = sharp("tmp/template.jpg");

        let buffer = await sharp(path)
            .resize({ width: 950 })
            .toBuffer();
        sharp(buffer).toFile(path).then( async () => {
            template.composite([
                { input: path }, { input: 'tmp/text.png', gravity: 'south'}
            ]);
    
            await template.toFile('tmp/thumbnail.jpeg');
        }).then(() => resolve("tmp/thumbnail.jpeg"));
    });
}

export {downloadImage, editImage};