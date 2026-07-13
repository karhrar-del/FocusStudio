const { app } = require('electron')
const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')
const AdmZip = require('adm-zip')
const https = require('https')
const http = require('http')

const VERSION_URL = 'https://raw.githubusercontent.com/karhrar-del/FocusStudio/main/version.json'
const DOWNLOAD_URL = 'https://github.com/karhrar-del/FocusStudio/releases/latest/download/update.zip'

function fetchBuffer(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http
        const parsedUrl = new URL(url)
        const opts = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (url.startsWith('https') ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: { 'User-Agent': 'FocusStudio' }
        }
        const req = protocol.request(opts, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume()
                const redirectUrl = new URL(res.headers.location, url).href
                return resolve(fetchBuffer(redirectUrl))
            }
            if (res.statusCode !== 200) {
                res.resume()
                return reject(new Error('HTTP ' + res.statusCode))
            }
            const chunks = []
            res.on('data', (chunk) => chunks.push(chunk))
            res.on('end', () => resolve(Buffer.concat(chunks)))
        })
        req.on('error', reject)
        req.end()
    })
}

function compareVersions(v1, v2) {
    const p1 = v1.split('.').map(Number)
    const p2 = v2.split('.').map(Number)
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0
        const n2 = p2[i] || 0
        if (n1 > n2) return 1
        if (n1 < n2) return -1
    }
    return 0
}

function getCurrentVersion() {
    const pkgPath = path.join(app.getAppPath(), 'package.json')
    return JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version
}

async function checkForUpdate() {
    const currentVersion = getCurrentVersion()
    const versionBuffer = await fetchBuffer(VERSION_URL)
    const remote = JSON.parse(versionBuffer.toString('utf-8'))
    const remoteVersion = (remote.version || '').trim()

    if (!remoteVersion) {
        throw new Error('ملف الإصدارات البعيد غير صالح')
    }

    console.log('[Updater] Current: ' + currentVersion + ', Remote: ' + remoteVersion)

    return {
        hasUpdate: compareVersions(remoteVersion, currentVersion) > 0,
        currentVersion,
        remoteVersion
    }
}

function findFileRecursive(dir, predicate) {
    if (!fs.existsSync(dir)) return null
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name)
            if (entry.isFile() && predicate(entry.name, fullPath)) return fullPath
            if (entry.isDirectory()) {
                const found = findFileRecursive(fullPath, predicate)
                if (found) return found
            }
        }
    } catch (e) {}
    return null
}

async function downloadAndInstall() {
    const userDataPath = app.getPath('userData')
    const updateDir = path.join(userDataPath, '.focus-update')
    const extractPath = path.join(updateDir, 'extracted')

    if (fs.existsSync(updateDir)) fse.removeSync(updateDir)
    fs.mkdirSync(extractPath, { recursive: true })

    try {
        const zipBuffer = await fetchBuffer(DOWNLOAD_URL)
        if (zipBuffer.length === 0) throw new Error('ملف التحديث فارغ')

        // Manual extraction: bypass adm-zip's fs.chmodSync crash on Windows
        const zip = new AdmZip(Buffer.from(zipBuffer))
        for (const entry of zip.getEntries()) {
            const entryPath = path.join(extractPath, entry.entryName)
            if (entry.isDirectory) {
                if (!fs.existsSync(entryPath)) {
                    fs.mkdirSync(entryPath, { recursive: true })
                }
                continue
            }
            try {
                const parentDir = path.dirname(entryPath)
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true })
                }
                // Skip if a directory already occupies this path
                if (fs.existsSync(entryPath) && fs.statSync(entryPath).isDirectory()) {
                    console.warn('[Updater] Skipping ' + entry.entryName + ': path occupied by a directory')
                    continue
                }
                fs.writeFileSync(entryPath, entry.getData())
            } catch (err) {
                console.warn('[Updater] Skipping ' + entry.entryName + ': ' + err.message)
            }
        }

        // --- Flexible content detection ---
        let sourcePath = null
        let targetPath = null

        // Case A: extracted/app.asar is a real FILE → replace asar at resources
        const asarPath = path.join(extractPath, 'app.asar')
        if (fs.existsSync(asarPath) && fs.statSync(asarPath).isFile()) {
            sourcePath = asarPath
            targetPath = path.join(process.resourcesPath, 'app.asar')
            try {
                const { spawn } = require('child_process')
                const batPath = path.join(app.getPath('userData'), 'update.bat')
                const batContent = `
@echo off
timeout /t 2 /nobreak > NUL
copy /Y "${sourcePath}" "${targetPath}"
start "" "${process.execPath}"
del "%~f0"
`
                fs.writeFileSync(batPath, batContent.trim())
                
                spawn('cmd.exe', ['/c', batPath], {
                    detached: true,
                    stdio: 'ignore'
                }).unref()
                
                app.quit()
                return
            } catch (err) {
                console.warn('[Updater] Could not schedule app.asar replacement: ' + err.message)
                sourcePath = null
            }
        }

        // Case B: extracted/app.asar is a DIRECTORY (unpacked content) → copy its contents
        if (!sourcePath && fs.existsSync(asarPath) && fs.statSync(asarPath).isDirectory()) {
            const innerOut = path.join(asarPath, 'out')
            if (fs.existsSync(innerOut)) {
                sourcePath = innerOut
                targetPath = path.join(app.getAppPath(), 'out')
                await fse.copy(sourcePath, targetPath, { overwrite: true, errorOnExist: false })
                console.log('[Updater] Copied asar/out/ to ' + targetPath)
            }
        }

        // Case C: find main/index.js anywhere (e.g., out/ structure)
        if (!sourcePath) {
            const mainIndex = findFileRecursive(extractPath, (name, fullPath) => {
                return name === 'index.js' && fullPath.replace(/\\/g, '/').endsWith('main/index.js')
            })
            if (mainIndex) {
                sourcePath = path.dirname(path.dirname(mainIndex))
                targetPath = path.join(app.getAppPath(), 'out')
                await fse.copy(sourcePath, targetPath, { overwrite: true, errorOnExist: false })
                console.log('[Updater] Copied ' + sourcePath + ' to ' + targetPath)
            }
        }

        if (!sourcePath) {
            throw new Error('ملف التحديث لا يحتوي على الملفات المطلوبة')
        }
    } finally {
        if (fs.existsSync(updateDir)) fse.removeSync(updateDir)
    }
}

module.exports = { checkForUpdate, downloadAndInstall }
