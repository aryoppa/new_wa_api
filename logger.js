const { existsSync, mkdirSync, appendFile, appendFileSync } = require("fs");
const readline = require("readline");


async function writetoFile(name, nowa, question, response){
    const logDir = "./logs";
    const number = nowa?.replaceAll('@s.whatsapp.net', '');
    const data ={"client": name, "phone number": number, "question": question, "answer": response};

    const options = {
        encoding: 'utf8',
        mode: 0o666
    };


    appendFileSync(`${logDir}/${number}.log`, JSON.stringify(data) + "\n", options);
};


module.exports = {
    writetoFile
};
