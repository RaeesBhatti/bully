const puppeteer = require('puppeteer');
const fs = require('fs');

const users = [];
const usersVisited = [];

const groups = [];
const groupsVisited = [];

const data = {};

const SITE_URL = process.env.SITE_URL;
const SITE_USERNAME = process.env.SITE_USERNAME;
const SITE_PASSWORD = process.env.SITE_PASSWORD;

(async () => {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    page.setViewport({width: 1366, height: 768});
    const interval = setInterval(() => fs.writeFileSync('./data.json', JSON.stringify(data)), 100000);
    await findNewLinks(page, '35','group',true);
    clearInterval(interval);
    fs.writeFileSync('./data.json', JSON.stringify(data))

    await browser.close();
})();

const findNewLinks = async (page, id, pageKind = 'user', first = false) => {
    const link = `${SITE_URL}${pageKind === 'user' ? 'member.php?u=' + id : `group.php?groupid=${id}&do=viewmembers`}`
    await page.goto(link, {timeout: 120000});

    if (first) {
        const userNameEl = await page.$('#vb_login_username');
        await userNameEl.click({delay: 100});
        await userNameEl.type(SITE_USERNAME, {delay: 90});
        const passwordEl = await page.$('#vb_login_password');
        await passwordEl.click({delay: 120});
        await passwordEl.type(SITE_PASSWORD, {delay: 110});
        const loginBtn = await page.$('.actionbuttons input[type=submit]')
        await loginBtn.click({delay: 160})
    }

    await page.waitFor(() => !!document.getElementById('socialgroup_members') || !!document.getElementById('userinfo'), {timeout: 120000});

    if (pageKind === 'user') {
        usersVisited.push(id)
    } else {
        groupsVisited.push(id)
    }

    const userIds = await page.$$eval('a[href^="member.php"]', ls => ls.map(a => new URL(a).searchParams.get('u')))
    userIds
        .filter(id => !!id && id.length)
        .filter(id => !usersVisited.includes(id) && !users.includes(id))
        .forEach(id => users.push(id))

    const groupIds = await page.$$eval('a[href^="group.php"]', ls => ls.map(a => new URL(a).searchParams.get('groupid')))
    groupIds
        .filter(id => !!id && id.length)
        .filter(id => !groupsVisited.includes(id) && !groups.includes(id))
        .forEach(id => groups.push(id))


    if (pageKind === 'user' && !data.hasOwnProperty(id)) {
        const userData = {basicInfo: null, contact: null, stats: null}
        const basicInfo = await page.$('#view-aboutme > .subsection')
        if (basicInfo) {
            const text = await (await basicInfo.getProperty('textContent')).jsonValue();
            userData.basicInfo = text.trim()
        }
        const contact = await page.$('#view-contactinfo')
        if (contact) {
            const text = await (await contact.getProperty('textContent')).jsonValue();
            userData.contact = text.trim()
        }
        const stats = await page.$('#view-stats')
        if (stats) {
            const text = await (await stats.getProperty('textContent')).jsonValue();
            userData.stats = text.trim()
        }
        data[id] = userData
    }

    if (users.length) {
        const userId = users.shift()
        return findNewLinks(page, userId, 'user')
    }
    if (groups.length) {
        const groupId = groups.shift()
        return findNewLinks(page, groupId, 'group')
    }

    return true
}
