'use strict';

const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');

const calcHash = require('../lib/hash');
const paths = require('../lib/paths');
const getFile = require('../lib/get-file');

const getTargetDir = paths.getTargetDir;
const getAssetsPath = paths.getAssetsPath;
const normalize = paths.normalize;

const getHashName = (file, options) =>
    (options && options.append ? (`${path.basename(file.path, path.extname(file.path))}_`) : '')
  + calcHash(file.contents, options)
  + path.extname(file.path);

const createDirAsync = (dirPath) => {
    return new Promise((resolve, reject) => {
        mkdirp(dirPath, (err) => {
            if (err) reject(err);
            resolve();
        });
    });
};

const writeFileAsync = (file, dest) => {
    return new Promise((resolve, reject) => {
        fs.open(dest, 'wx', (err, fd) => {
            if (err) {
                if (err.code === 'EEXIST') {
                    resolve();
                }

                reject(err);
            }

            resolve(fd);
        });
    })
        .then((fd) => {
            if (!fd) return;

            return new Promise((resolve, reject) => {
                fs.writeFile(dest, file.contents, (err) => {
                    if (err) {
                        reject(err);
                    }
                    resolve();
                });
            });
        });
};

/**
 * Copy images from readed from url() to an specific assets destination
 * (`assetsPath`) and fix url() according to that path.
 * You can rename the assets by a hash or keep the real filename.
 *
 * Option assetsPath is require and is relative to the css destination (`to`)
 *
 * @type {PostcssUrl~UrlProcessor}
 * @param {PostcssUrl~Asset} asset
 * @param {PostcssUrl~Dir} dir
 * @param {PostcssUrl~Option} options
 * @param {PostcssUrl~Decl} decl
 * @param {Function} warn
 * @param {Result} result
 * @param {Function} addDependency
 *
 * @returns {Promise<String|Undefined>}
 */

module.exports = function processCopy(asset, dir, options, decl, warn, addDependency) {
    if (!options.assetsPath && dir.from === dir.to) {
        warn('Option `to` of postcss is required, ignoring');

        return Promise.resolve();
    }

    return getFile(asset, options, dir, warn)
        .then((file) => {
            const assetRelativePath = options.useHash
                ? getHashName(file, options.hashOptions)
                : asset.relativePath;

            const targetDir = getTargetDir(dir);
            const newAssetBaseDir = getAssetsPath(targetDir, options.assetsPath);
            const newAssetPath = path.join(newAssetBaseDir, assetRelativePath);
            const newRelativeAssetPath = normalize(path.relative(targetDir, newAssetPath));

            return createDirAsync(path.dirname(newAssetPath))
                .then(() => writeFileAsync(file, newAssetPath))
                .then(() => {
                    addDependency(file.path);

                    return `${newRelativeAssetPath}${asset.search}${asset.hash}`;
                });
        }
        );
};
