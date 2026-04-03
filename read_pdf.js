const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('documents/UseCaseFinal.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(function(err) {
    console.error(err);
});
