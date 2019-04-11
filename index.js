
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
            callback();
        });
    }).end();
}

function getImageFromChapter(uri, imageNumber, callback) {
    let next = '';
    let strImgNum = '000' + imageNumber;
    strImgNum = strImgNum.substring(strImgNum.length - 3);
    let dirName = 'images/' + uri.split('/')[1];
    let chapNumber = uri.split('/')[2];
    let filename = dirName + '/chap' + chapNumber + '-image' + strImgNum + '.jpg';
    https.get(base_url + uri + '/' + imageNumber, (resp) => {
        let html = '';
        resp.on('data', (chunk) => {
            html += chunk;
        });
        resp.on('end', () => {
            const $ = cheerio.load(html);
            if ($('.episode-table').length == 0) {
                // Chapter not released yet
                console.log('/!\\ This chapter seems to not be released yet.')
                return;
            }
            let img_url = $('.episode-table #imgholder a img')[0]['attribs']['src'];
            next = $('#imgholder a')[0]['attribs']['href'];
            getImage(img_url, filename, () => {
                callback(next);
            });
        });
    }).on('error', (err) => {
        console.log('Error:', err.message);
    });
}

function getFilesForChapter(chapterURI, imageNumber, callback) {
    let chapNumber = chapterURI.split('/')[2];
    getImageFromChapter(chapterURI, imageNumber, (next) => {
        console.log('Next Chapter Page:', next);
        let chap = next.split("/");
        if (chapNumber == chap[2]) {
            // console.log('Same Chapter should continue');
            getFilesForChapter(chapterURI, chap[3], callback)
        } else {
            callback(next);
        }
    });
}

function isChapterOut(uri, imageNumber, callback) {
    https.get(base_url + uri + '/' + imageNumber, (resp) => {
        let html = '';
        resp.on('data', (chunk) => {
            html += chunk;
        });
        resp.on('end', () => {
            const $ = cheerio.load(html);
            if ($('.episode-table').length == 0) {
                // Chapter not released yet
                console.log('/!\\ This chapter seems to not be released yet.')
                return false;
            }
            callback();
            return true;
        });
    }).on('error', (err) => {
        console.log('Error:', err.message);
    });
}

function manageChapter(chapterURI, imageNumber = '1') {
    let mangaName = chapterURI.split('/')[1];
    let dirName = 'images/' + mangaName;
    let chapNumber = chapterURI.split('/')[2];
    console.log('Chapter', chapNumber);
    // Manage FS
    if (!fs.existsSync(dirName)) {
        console.log("Directory", dirName, "is not existing, creating...");
        fs.mkdirSync(dirName, { recursive: true });
    }
    // Launch the getter
    getFilesForChapter(chapterURI, imageNumber, (nextChapterUri) => {
        let chapNumber = chapterURI.split('/')[2];
        // then we can do the zipping...
        console.log('~ DL Done.');
        console.log('~ Zipping files to cbz');
        var zip = new jszip();
        let files = fs.readdirSync(dirName);
        let toClean = [];
        files.forEach((file) => {
            if (file == '.gitkeep') {
                return;
            }
            if (!file.startsWith('chap' + chapNumber + '-')) {
                // console.log("skipping file:", file);
                return;
            }
            // console.log(file);
            zip.file(file, fs.readFileSync(dirName + '/' + file));
            toClean.push(file);
        });
        console.log('~ Number of pages:', files.length);
        // cleaning temporary files
        toClean.forEach((file) => {
            // console.log('Should clean:', file);
            fs.unlinkSync(dirName + '/' + file);
        });
        // console.log('Directory read...');
        zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
            .pipe(fs.createWriteStream('cbz/' + mangaName + '-chap' + chapNumber + '.cbz'))
            .on('finish', () => {
                console.log("~ Chapter Ready for reading :", 'cbz/' + mangaName + '-chap' + chapNumber + '.cbz');
            });
        // Launch the next chapter:
        manageChapter(nextChapterUri, 1)
    });

}

function manageManga(mangaName) {
    let mangaURL = '/' + mangaName + '/';

    // lookup for files named after this manga:
    let files = fs.readdirSync('cbz/');
    let bestIndex = 0;
    files.forEach((file) => {
        if (file.startsWith(mangaName)) {
            let idx = file.split('-');
            let chapIndex = parseInt(idx[idx.length - 1].split('.')[0].substring(4), 10);
            if (chapIndex > bestIndex) {
                bestIndex = chapIndex;
            }
        }
    });
    bestIndex = bestIndex + 1;

    // Should we get this Chapter or is it the last one ?
    manageChapter(mangaURL + bestIndex);
}



manageManga("shokugeki-no-soma");
/*
manageManga("hunter-x-hunter")
manageManga("one-piece")
*/
