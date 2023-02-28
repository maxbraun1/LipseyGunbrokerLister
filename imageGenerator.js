import fs from 'fs';
import client from 'https';
import sharp from 'sharp';
import { logProcess } from './index.js';



async function generateImagesOld(url){
    return new Promise(async (resolve, reject) => {
        console.log("here1");
        client.get(url, (res) => {
            console.log("here2");
            if (res.statusCode === 200) {
                console.log("here3");
                res.setTimeout(5000);
                res.pipe(fs.createWriteStream('tmp/tmp.jpeg', { mode: 0o644 }))
                    .on('error', (error) => {
                        console.log(error);
                        reject(error);
                    })
                    .on('close', async () => {
                        console.log("here4");
                        try{
                            sharp.cache(false);
                            console.log("here10");
                            let template = sharp("tmp/template.jpg");
                            console.log("here11");
                            let tmpBuffer = await sharp('tmp/tmp.jpeg').resize({ width: 950 }).toBuffer();
                            console.log("here12");
                            await sharp(tmpBuffer).toFile('tmp/tmp.jpeg');
                            console.log("here13");
                            template.composite([
                                { input: 'tmp/tmp.jpeg' }, { input: 'tmp/text.png', gravity: 'south'}
                            ]);
                            console.log("here14");
                            await template.toFile('tmp/thumbnail.jpeg');
                            console.log("here5");
                            resolve();
                        }catch (error) {
                            console.log("here6");
                            reject(error);
                        }
                    });
            } else {
                console.log("here7");
                // Consume response data to free up memory
                res.resume();
                reject("Couldn't download file.");
            }
        }).on('error', function(e) {
            console.log("here8");
            logProcess('problem with request: ' + e.message, 'bad');
            reject("Connection Interuption");
        }).end();
    }).catch(function(err) {
        console.log(err);
    });
}

async function generateImages(url){
    return new Promise(async (resolve, reject) => {
        console.log("here1");
        const file = fs.createWriteStream('tmp/tmp.jpeg', { mode: 0o644 });
        console.log("here2");
        const request = client.get(url, {"Connection": "keep-alive"}, function(response) {
            if (response.statusCode === 200) {
                response.pipe(file);

                // after download completed close filestream
                file.on("finish", async () => {
                    file.close();
                    console.log("here2");
                    try{
                        sharp.cache(false);
                        console.log("here10");
                        let template = sharp("tmp/template.jpg");
                        console.log("here11");
                        let tmpBuffer = await sharp('tmp/tmp.jpeg').resize({ width: 950 }).toBuffer();
                        console.log("here12");
                        await sharp(tmpBuffer).toFile('tmp/tmp.jpeg');
                        console.log("here13");
                        template.composite([
                            { input: 'tmp/tmp.jpeg' }, { input: 'tmp/text.png', gravity: 'south'}
                        ]);
                        console.log("here14");
                        await template.toFile('tmp/thumbnail.jpeg');
                        console.log("here5");
                        resolve();
                    }catch (error) {
                        console.log("here6");
                        reject(error);
                    }
                });
            } else {
                console.log("here7");
                // Consume response data to free up memory
                res.resume();
                reject("Couldn't download file.");
            }
        }).on('error', function(e) {
            console.log("here8");
            logProcess('problem with request: ' + e.message, 'bad');
            reject("Connection Interuption");
        });
    }).catch(function(err) {
        console.log(err);
    });
}

export {generateImages};