#!/usr/bin/env node
'use strict'


/**
 * Modules
 * Node
 * @constant
 */
const fs = require('fs')
const os = require('os')
const path = require('path')

/**
 * Modules
 * External
 * @constant
 */
const appRootPath = require('app-root-path')
appRootPath.setPath(path.join(__dirname, '..'))
const chalk = require('chalk');
const logger = require('@sidneys/logger')({ write: true })
const fastXmlParser = require('fast-xml-parser');
const minimist = require('minimist')
const moment = require('moment')
const momentDurationFormat = require('moment-duration-format')
const momentParseFormat = require('moment-parseformat')

/**
 * Modules
 * Internal
 * @constant
 */
const help = require(path.join(appRootPath.path, 'lib', 'help'))
const packageJson = require(path.join(appRootPath.path, 'package.json'))

/**
 * Log prefix
 * @constant
 */
const messagePrefix = chalk['bold']['cyan'](`[${packageJson.name}]`);
const errorPrefix = chalk['bold']['red'](`[${packageJson.name}]`);


/**
 * Render subtitle paragraph list into proper SRT (SubRip) subtitle format
 * @return {String} SubRip Subtitle
 */
let renderSrt = (paragraphList) => {
    logger.debug('renderSrt')

    const entryList = []
    let entryCount = 1

    paragraphList.forEach((entry) => {
        const metadata = entry['tt:p']
        const textList = entry['tt:span'] instanceof Array ? entry['tt:span'] : [ entry['tt:span'] ]
        const begin = moment.duration(metadata['begin']).subtract(10, 'hours').format('HH:mm:ss.SSS');
        const end = moment.duration(metadata['end']).subtract(10, 'hours').format('HH:mm:ss.SSS');

        entryList.push(entryCount)
        entryList.push(`${begin} --> ${end}`)

        entryList.push(textList.map(text => text['tt:span']).join(os.EOL) + os.EOL)

        entryCount++
    })

    return entryList.join(os.EOL)
}

/**
 * Parse XML Subtitle data payload into array of paragraphs
 * @return {Array|void} Subtitle paragraph list
 */
let parseXmlData = (xmlData) => {
    logger.debug('parseXmlData')

    const options = {
        attributeNamePrefix : "",
        attrNodeName: "tt:p", //default is 'false'
        textNodeName : "tt:span",
        ignoreAttributes : false,
        ignoreNameSpace : false,
        allowBooleanAttributes : false,
        cdataTagName: "__cdata", //default is 'false'
        cdataPositionChar: "\\c"
    };

    // Handle invalid XML
    if(fastXmlParser.validate(xmlData) !== true) {
        return false
    }

    const parsedObject = fastXmlParser.parse(xmlData, options);

    return parsedObject['tt:tt']['tt:body']['tt:div']['tt:p']
}


/**
 * Commandline interface
 */
if (require.main === module) {
    // Parse arguments
    let argv
    try {
        argv = minimist(process.argv.slice(2), {
            'boolean': ['help', 'version']
        })
    } catch (error) {}

    // DEBUG
    logger.debug('argv')

    // Help
    const argvHelp = argv['help']
    if (argvHelp) {
        help.print()
        process.exit(0)
    }

    // Version
    const argvVersion = argv['version']
    if (argvVersion) {
        console.log(messagePrefix, `v${packageJson.version}`)
        process.exit(0)
    }

    // Sourcefile
    const argvSourcefile = path.resolve(argv['_'][0])
    if (!argvSourcefile) {
        console.log(messagePrefix, `Source Subtitle XML required.`)
        process.exit(0)
    }
    if (!fs.existsSync(argvSourcefile)) {
        console.log(errorPrefix, '[Error]', `File not found: "${argvSourcefile}"`)
        process.exit(1)
    }

    // Targetfile
    const targetFile = path.resolve(`${path.basename(argvSourcefile, path.extname(argvSourcefile))}.srt`)

    // Main
    fs.readFile(argvSourcefile, 'utf8', (error, xmlData) => {
        if (error) {
            console.log(errorPrefix, '[Error]', error)
            process.exit(1)
            
            return
        }

        // Parse / Validate XML
        const entryList = parseXmlData(xmlData)
    
        if (!entryList) {
            console.log(errorPrefix, '[Error]', 'Malformed XML Subtitle:', argvSourcefile)
            process.exit(1)

            return
        }

        // Render SRT
        const srtText = renderSrt(entryList)

        // Write SRT to  disk
        fs.writeFile(targetFile, srtText, 'utf8', (error) => {
            if (error) {
                console.log(errorPrefix, '[Error]', error)
                process.exit(1)

                return
            }   

            console.log(messagePrefix, `Subtitle (EBU-TT XML) successfully converted to SubRip (SRT):`, targetFile)
            process.exit(0)
        });
    });
}