var isDefined = function(value) {
    return value !== null && typeof(value) !== 'undefined' && value !== 'undefined';
}

var isEmptyChar = function(value) {
    return !isDefined(value) || value == "" || value == " " || value == " " || value == '' || value == ' ' || value == '\t' || value == '\r' || value == '\n' || value == '\x0b';
}

var isEmpty = function(value) {
    return !isDefined(value) || value == "<br>" || !isDefined(value.length) || value.length <= 1 || isEmptyChar(value);
}

var isArray = function (value) {
    return Object.prototype.toString.call( value ) === '[object Array]';
}

var replaceWhitespaces = function (stringValue) {
    stringValue = stringValue.replace("\r", "").replace("\n", "").replace("  ", " ");

    if(!isEmpty(stringValue)) {
      console.log("string is not empty");
    }

    // remove first whitespace
    if(!isEmpty(stringValue) && stringValue.charAt(0) == ' ') {
      console.log("remove first whitespace");
      stringValue = stringValue.slice(1);
    }

    if(!isEmpty(stringValue)) {
      console.log("string is not empty");
    }

    console.log(isEmptyChar(" "));

    console.log(stringValue.charAt(stringValue.length-1)+": "+isEmptyChar(stringValue.charAt(stringValue.length-1)));
    console.log(stringValue.charAt(stringValue.length-1)+": "+stringValue.charAt(stringValue.length-1) == " ");

    // remove last whitespace
    if(!isEmpty(stringValue) && stringValue.charAt(stringValue.length-1) === ' ') {
      console.log("remove latest whitespace");
      stringValue = stringValue.slice(0, stringValue.length-1);
    }
        

    return stringValue;
}

// var hallo = "welt";

// var split = hallo.split("\n");

// console.log(split);

// var welt = " welt";

// if(welt.charAt(0) == " ")
//   welt = welt.slice(1);

// console.log(welt);

// var foo = " Grund schlechter Passform und mangelnder Materialstärke darauf diese anzubieten. ";

// foo = replaceWhitespaces(foo);

// console.log(foo+";");

var bar = "\r\ntest\n\r\r\n\r\n  test\r\n\ntest\r\r\n\r\n  test  \r\n\n\r\r\n\r\n  ";

var regex = new RegExp("\r|\n|  ", 'g');

//var result = stringValue.replace("\r", "").replace("\n", "").replace("  ", " ");
var result = bar.replace(regex, "");

console.log(result);