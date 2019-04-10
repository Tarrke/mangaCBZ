
import * as https from 'https';
import * as cheerio from 'cheerio';
// import { Stream } from "stream";
import { Transform as Stream } from 'stream';
import * as fs from 'fs';
import jszip from 'jszip';

let base_url = 'https://www.mangareader.net'

function getImage(imageURL, filename, callback) {
    https.get(imageURL, (resp) => {
        var data = new Stream();

        resp.on('data', (chunk) => {
            data.push(chunk);
        });
        resp.on('end', () => {
            fs.writeFileSync(filename, data.read());
        });
        resp.on('close', callback);
    }).end();
}

function getImageFromChapter(uri, imageNumber, callback) {
    let next = '';
    let strImgNum = '000' + imageNumber;
    strImgNum = strImgNum.substring(strImgNum.length - 3);
    let dirName = 'images/' + uri.split('/')[1];
    let filename = dirName + '/image' + strImgNum + '.jpg';
    https.get(base_url + uri + '/' + imageNumber, (resp) => {
        let html = '';
        resp.on('data', (chunk) => {
            html += chunk;
        });
        resp.on('end', () => {
            // console.log(html);
            const $ = cheerio.load(html);
            //console.log($('#imgholder a'));
            console.log($('#imgholder a img')[0]['attribs']['src'])
            let img_url = $('#imgholder a img')[0]['attribs']['src'];
            next = $('#imgholder a')[0]['attribs']['href'];
            getImage(img_url, filename, () => { });
        });
        resp.on('close', () => {
            callback(next);
        });
    }).on('error', (err) => {
        console.log('Error:', err.message);
    });
}

function manageChapter(chapterURI, imageNumber = '1') {
    let mangaName = chapterURI.split('/')[1];
    let dirName = 'images/' + mangaName;
    // Manage FS
    if (!fs.existsSync(dirName)) {
        console.log("Directory", dirName, "is not existing.");
        fs.mkdirSync(dirName, { recursive: true });
        return;
    }
    let files = fs.readdirSync(dirName);
    files.forEach((file) => {
        if (file == '.gitkeep') {
            return;
        }
        if( fs.lstatSync(dirName).isDirectory() ) {
            console.log(file, 'is a directory, skipping...')
            return;
        }
        fs.unlinkSync(dirName + '/' + file);
    });

    // Launch the getter
    getFilesForChapter(chapterURI, imageNumber, () => {
        let chapNumber = chapterURI.split('/')[2];
        // then we can do the zipping...
        console.log("DL Done.");
        console.log('Zipping files to cbz');
        var zip = new jszip();
        let files = fs.readdirSync(dirName);
        files.forEach((file) => {
            if (file == '.gitkeep') {
                return;
            }
            console.log(file);
            zip.file(file, fs.readFileSync(dirName + '/' + file));
        });
        console.log('Directory read...');
        zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
            .pipe(fs.createWriteStream('cbz/'+mangaName+'-chap' + chapNumber + '.cbz'))
            .on('finish', () => {
                console.log("Chapter Ready for reading :", 'cbz/'+mangaName+'-chap' + chapNumber + '.cbz');
            });
    });

}

function getFilesForChapter(chapterURI, imageNumber, callback) {
    let chapNumber = chapterURI.split('/')[2];
    getImageFromChapter(chapterURI, imageNumber, (next) => {
        console.log('Next Chapter Page:', next);
        let chap = next.split("/");
        if (chapNumber == chap[2]) {
            console.log('Same Chapter should continue');
            getFilesForChapter(chapterURI, chap[3], callback)
        } else {
            callback();
            /*

            */
        }
    });
}

manageChapter("/shokugeki-no-soma/2");

