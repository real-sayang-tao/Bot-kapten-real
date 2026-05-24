const fs = require('fs');
const axios = require('axios');
const pino = require('pino');
const { useMultiFileAuthState, makeWASocket, getContentType } = require('@whiskeysockets/baileys');

// ========== CONFIG ==========
const nomorOwner = "6289525597016@s.whatsapp.net";
const userDbPath = './userDb.json';
const codeDbPath = './codeDb.json';
let globalBooster = { xp: false, luck: false };

// ========== CHARACTER POOL ==========
const characterPool = {
    "S+": { rate: 0.05, items: ["Spirit Warrior (Goku)", "Cosmic Garou", "Sun God (Yoriichi)", "Dio / The World"] },
    "S": { rate: 0.5, items: ["Gilgamesh", "Limitless Gojo", "Sukuna", "Solo Hunter (Jinwoo)", "Anos Voldigoad", "Ice Queen"] },
    "A": { rate: 1.0, items: ["Qin Shi Huang", "Yuji Itadori"] }
};

// ========== USER FUNCTIONS ==========
function getUser(sender) {
    if (!fs.existsSync(userDbPath)) fs.writeFileSync(userDbPath, JSON.stringify({}));
    let data = JSON.parse(fs.readFileSync(userDbPath, 'utf8'));
    if (!data[sender]) {
        data[sender] = {
            level: 1, permata: 1000, exp: 0, totalChat: 0,
            stat: { str: 0, agi: 0, vit: 0 }, statPoint: 0,
            inventory: [], currentTitle: "⚓ Novice",
            gachaLimit: 0, charLimit: 0, lastGachaDate: "", lastCharDate: "",
            dailyStreak: 0, lastDaily: "", advLimit: 0, lastAdvDate: ""
        };
    }
    if (sender.includes(nomorOwner)) {
        data[sender].level = 999;
        data[sender].currentTitle = "👑 KING OF THE GOD OWNER";
        data[sender].stat = { str: 100, agi: 100, vit: 100 };
        data[sender].permata = 999999999;
        data[sender].statPoint = 999;
    }
    if (!data[sender].stat) data[sender].stat = { str: 0, agi: 0, vit: 0 };
    return data[sender];
}

function saveUser(sender, userData) {
    let data = JSON.parse(fs.readFileSync(userDbPath));
    data[sender] = userData;
    fs.writeFileSync(userDbPath, JSON.stringify(data, null, 2));
}

function getBuff(user, sender) {
    if (sender.includes(nomorOwner)) return { gems: 1.20, xp: 1.25, luck: 100 };
    let b = { gems: 1.0, xp: 1.0, luck: 0 };
    b.gems += (user.stat.str * 0.01);
    b.xp += (user.stat.agi * 0.01);
    b.luck += (user.stat.vit * 0.5);
    if (user.level >= 999) { user.currentTitle = "🌌 THE ONE"; b.gems += 0.20; b.xp += 0.25; b.luck += 15; }
    else if (user.level >= 500) { user.currentTitle = "🔱 GOLDEN TYRANT"; b.gems += 0.15; b.xp += 0.15; b.luck += 10; }
    return b;
}

// ========== UTILITY FUNCTIONS ==========
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function gachaAnimation(sock, from, m) {
    const frames = ["🎰 ɢᴀᴄʜᴀ ʀᴏʟʟɪɴɢ .", "🎰 ɢᴀᴄʜᴀ ʀᴏʟʟɪɴɢ . .", "🎰 ɢᴀᴄʜᴀ ʀᴏʟʟɪɴɢ . . .", "✨ ᴍᴇɴᴇɴᴛᴜᴋᴀɴ ᴛᴀᴋᴅɪʀ . . ."];
    let { key } = await sock.sendMessage(from, { text: "🎰 ɢᴀᴄʜᴀ ʀᴏʟʟɪɴɢ" }, { quoted: m });
    for (let frame of frames) { await sleep(700); await sock.sendMessage(from, { text: frame, edit: key }); }
    return key;
}

async function dailyPatrol(sock) {
    try {
        const res = await axios.get('https://beebom.com');
        const found = res.data.match(/<strong>(.*?)<\/strong>/g).map(v => v.replace(/<\/?strong>/g,'')).filter(c => c === c.toUpperCase() && c.length > 4);
        let stored = fs.existsSync(codeDbPath) ? JSON.parse(fs.readFileSync(codeDbPath)) : [];
        let fresh = found.filter(c => !stored.includes(c));
        if (fresh.length >= 3) fs.writeFileSync(codeDbPath, JSON.stringify([...new Set([...stored, ...fresh])], null, 2));
    } catch (e) { console.log("Patrol Error") }
}

// ========== BOT MAIN ==========
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_v5_elite');
    const sock = makeWASocket({ auth: state, logger: pino({ level: 'silent' }), printQRInTerminal: true });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (up) => {
        if (up.connection === 'open') console.log('🚢 SAILOR V5 ELITE READY!');
        if (up.connection === 'close') startBot();
    });

    sock.ev.on('messages.upsert', async (chat) => {
        try {
            const m = chat.messages[0];
            if (!m.message || m.key.fromMe) return;
            const from = m.key.remoteJid;
            const participant = m.key.participant || from;
            const isOwner = participant.includes(nomorOwner);
            const type = getContentType(m.message);
            const body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : '';
            const args = body.trim().split(/ +/).slice(1);
            const cmd = body.trim().split(/ +/)[0].toLowerCase();
            const tgl = new Date().toLocaleDateString();

            let user = getUser(participant);
            const b = getBuff(user, participant);

            if (!isOwner) {
                user.totalChat += 1;
                let gain = (10 + (user.stat.agi * 2)) * b.xp;
                if (globalBooster.xp) gain *= 2;
                user.exp += Math.floor(gain);
                if (user.exp >= user.level * 150) {
                    user.level += 1; user.exp = 0;
                    if (user.level % 10 === 0) user.statPoint += 1;
                }
            }
            saveUser(participant, user);

            switch (cmd) {
                case '.menu':
                    const v5Menu = `┏━━━━━━━[ ⚓ *SAILOR V5 ELITE* ⚓ ]━━━━━━━┓\n┃\n┃  👤 *USER INFO*\n┃  ID: @${participant.split('@')[0]}\n┃  Rank: ${user.currentTitle}\n┃  Gems: ${isOwner ? '∞' : user.permata.toLocaleString()}\n┃\n┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n┃\n┃  🏴‍☠️ *SAILOR COMMANDS*\n┃  ∘ .me | .inv | .upstat\n┃  ∘ .daily | .adventure | .tf\n┃\n┃  🎰 *GACHA SYSTEM*\n┃  ∘ .gachaitem | .gachachar\n┃\n┃  🔍 *DATABASE LOOKUP*\n┃  ∘ .cekallitem | .cekallset\n┃  ∘ .cekalltitle\n┃\n┃  👑 *OWNER EXCLUSIVE*\n┃  ∘ .givegems | .setxp | .setluck\n┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;
                    await sock.sendMessage(from, { text: v5Menu, mentions: [participant] }, { quoted: m }); break;

                case '.cekallitem':
                    const tI = `╔══════════════════════════════════════╗\n║        🚢  LIST ALL ITEM GACHA  🚢       ║\n╠══════════════════════════╦═══════════╣\n║        ITEM RANK         ║   RATE    ║\n╠══════════════════════════╬═══════════╣\n║ 🛡️ Adamantite (S+)       ║    5%     ║\n║ 🤫 Secret Chest (S+)     ║    5%     ║\n║ ✨ Aura Crate (S+)       ║    5%     ║\n║ 🔶 Diamond (S)           ║    15%    ║\n║ 🔴 Mythic Chest (S)      ║    15%    ║\n║ 💎 Mythril (A)           ║    30%    ║\n║ 🟡 Legendary Chest (A)   ║    30%    ║\n║ 🪨 Obsidian (B)          ║    50%    ║\n║ 🪵 Wood (C-D)            ║    80%    ║\n╚══════════════════════════╩═══════════╝`;
                    await sock.sendMessage(from, { text: tI }); break;

                case '.cekallset':
                    const tS = `╔══════════════════════════════════════╗\n║        🎭  CHARACTER ELITE SET  🎭       ║\n╠══════════════════════════╦═══════════╣\n║      CHARACTER NAME      ║   RATE    ║\n╠══════════════════════════╬═══════════╣\n║ 🌌 Spirit Warrior (Goku) ║   0.05%   ║\n║ 🌌 Cosmic Garou          ║   0.05%   ║\n║ ☀️ Sun God (Yoriichi)    ║   0.05%   ║\n║ ⏳ Dio / The World       ║   0.05%   ║\n║ ⚔️ Gilgamesh (S)          ║   0.5%    ║\n║ ♾️ Limitless Gojo (S)    ║   0.5%    ║\n║ 💀 Sukuna (S)             ║   0.5%    ║\n║ 🗡️ Solo Hunter (Jinwoo)  ║   0.5%    ║\n║ 🏯 Qin Shi Huang (A)     ║   1.0%    ║\n║ 🐯 Yuji Itadori (A)      ║   1.0%    ║\n╚══════════════════════════╩═══════════╝`;
                    await sock.sendMessage(from, { text: tS }); break;

                case '.cekalltitle':
                    const sX = globalBooster.xp ? "ACTIVE" : "OFF   ";
                    const sL = globalBooster.luck ? "ACTIVE" : "OFF   ";
                    const tT = `┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n┃        🎖️ RANK & TITLE SYSTEM 🎖️        ┃\n┣━━━━━━━━━━━┳━━━━━┳━━━━━━┳━━━━━━┳━━━━━━┫\n┃   TITLE   ┃ LVL ┃ LUCK ┃ GEMS ┃  XP  ┃\n┣━━━━━━━━━━━╋━━━━━╋━━━━━━╋━━━━━━╋━━━━━━┫\n┃ 🌌 THE ONE┃ 999 ┃ 15%  ┃ +20% ┃ +25% ┃\n┃ 🔱 GOLDEN ┃ 500 ┃ 10%  ┃ +15% ┃ +15% ┃\n┃ ⚔️ WARRIOR ┃ 100 ┃ 5%   ┃ +10% ┃ +10% ┃\n┣━━━━━━━━━━━┻━━━━━┻━━━━━━┻━━━━━━┻━━━━━━┫\n┃ ⚡ BOOSTER: XP ${sX} | LUCK ${sL}   ┃\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;
                    await sock.sendMessage(from, { text: tT }); break;

                case '.me':
                    const meMsg = `┏━━━━━━━[ ⚓ *PROFILE PIRATE* ⚓ ]━━━━━━━┓\n┃\n┃  👤 User  : @${participant.split('@')[0]}\n┃  🏅 Level : ${isOwner ? "999 (GOD)" : user.level}\n┃  🎖️ Title : ${user.currentTitle}\n┃\n┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n┃  📊 STATS: 💪 STR:${user.stat.str} | 🏃 AGI:${user.stat.agi} | 🍀 VIT:${user.stat.vit}\n┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;
                    await sock.sendMessage(from, { text: meMsg, mentions: [participant] }); break;

                case '.upstat':
                    let type = args[0]?.toLowerCase();
                    if (user.statPoint > 0 && ['str','agi','vit'].includes(type)) {
                        user.stat[type] += 1; user.statPoint -= 1; saveUser(participant, user);
                        await sock.sendMessage(from, { text: `✅ UP ${type.toUpperCase()}!` });
                    } break;

                case '.daily':
                    if (user.lastDaily === tgl) return;
                    user.dailyStreak = (user.dailyStreak >= 30) ? 1 : user.dailyStreak + 1;
                    user.permata += (user.dailyStreak === 30) ? 5000 : 500;
                    user.lastDaily = tgl; saveUser(participant, user);
                    await sock.sendMessage(from, { text: `📅 Day ${user.dailyStreak} Checked!` }); break;

                case '.tf':
                    let targetTf = m.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
                    let jumlahTf = parseInt(args[1]);
                    if (targetTf && jumlahTf > 0 && (user.permata >= jumlahTf || isOwner)) {
                        let rec = getUser(targetTf); if (!isOwner) user.permata -= jumlahTf;
                        rec.permata += jumlahTf; saveUser(participant, user); saveUser(targetTf, rec);
                        await sock.sendMessage(from, { text: `✅ Transfer Berhasil!` });
                    } break;

                case '.gachachar':
                    const editK = await gachaAnimation(sock, from, m);
                    const resG = Math.random() < 0.05 ? "Cosmic Garou (S+)" : "Gilgamesh (S)";
                    user.inventory.push(resG); saveUser(participant, user);
                    await sock.sendMessage(from, { text: `🎰 Dapat: ${resG}!`, edit: editK }); break;

                case '.givegems':
                    if (!isOwner) return;
                    user.permata += 1000000; saveUser(participant, user);
                    await sock.sendMessage(from, { text: "🪄 Gems Added!" }); break;

                case '.setxp': if (isOwner) { globalBooster.xp = !globalBooster.xp; await sock.sendMessage(from, { text: "XP Switched!" }); } break;
            }
        } catch (e) { console.log(e) }
    });
}

startBot();