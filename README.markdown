## What?

An error tolerant JSON encoder and decoder written in JavaScript

## Why?

Because JavaScript doesn't actually have one. It has eval() which is famously unsafe, and some other functions may or may not be available, but these tend to be very strict and won't tolerate valid JavaScript syntax but invalid JSON syntax, e.g.

```js
'string' // single quotes are not valid 
{property: "value"} // unquoted property name 
NaN // doesn't exist
```

In each case it's perfectly obvious what they should represent, and a sensible JSON decoder shouldn't throw hard error messages on them.

Therefore, this library attempts to sensibly decode slightly erroneous JSON the best it can while logging errors.

## How?

The library adds two funtions to the global namespace:

```(object) readJSON(json_string [, errors]);
(string) writeJSON(object);
```

Errors is a reference to an array which will be populated with errors/warning information.

Warning! The writeJSON doesn't check for circular references, if your object has them, the function will hang.


## Details/Errors

The
Each error (as present in the errors array) is an object with the properties: *level* (0: warning or 1: error), *lineno* and *charno* (this might be either at the end of the erroneous text or at the start, it's not always trivial to get it consistent), and *desc* (a text description).


This parser will happily recognise (and raise warnings for) the following valid JavaScript but illegal JSON:

  * Single-quoted strings
  * Object properties which are not quoted at all
  * -/+ Infinity, NaN
  * Wrong escape sequences

*NOTE* that 'undefined' is not allowed.

This parser will grudgingly allow (and raise errors for) the following:

  * Unterminated types are closed at EOF. This may or may not make sense.
  * Empty object property names are ignored, so are empty values
  * Empty array values/too many separators
  * Terminators to types that aren't open on the top of the stack are ignored
  * Strange unrecognised symbols are ignored,


  The parser should continue after encountering an error, but if an error is raised, it means data was probably lost. This is about the time that you should consider rewriting your JSON.
