const fs = require( 'fs' );
var index = 0;

function getVertex( buffer ) {
  return '' + index++ +': ' + [
    buffer.readInt16LE( 1 ) << 8 | buffer.readInt8( 0 ),
    buffer.readInt16LE( 4 ) << 8 | buffer.readInt8( 3 ),
    buffer.readInt16LE( 7 ) << 8 | buffer.readInt8( 6 )
  ] + '\n';
}

function getVertexIndex( buffer ) {
  return '    ' + buffer.readUInt16LE( ) + '\n';
}

function getColors( buffer ) {
  var out = '\n';
  out += '  ambient: [r: ' + buffer.readUInt8( 0 ) +
    ',g: ' + buffer.readUInt8( 1 ) +
    ',b: ' + buffer.readUInt8( 2 ) + ']\n';
  out += '  diffuse: [r: ' + buffer.readUInt8( 3 ) +
    ',g: ' + buffer.readUInt8( 4 ) +
    ',b: ' + buffer.readUInt8( 5 ) + ']';

  return out;
}

function decodeVertexGroup( file, buffer, offset ) {
  var length = buffer.readInt8( offset + 1 ),
    i = 0;

  writeHeader( file, 'VERTICES', {
    length
  } );

  for ( ; i < length; i++ ) {
    fs.appendFile( file, getVertex( buffer.slice( 9 * i + 2, 9 * ( i + 1 ) + 2 ) ), ( e ) => {
      if ( e ) throw e;
    } );
  }

  return 2 + length * 9;
}

function decodeTriangleGroup( file, buffer, offset ) {
  var length = buffer.readInt8( offset + 8 ),
    colors = getColors( buffer.slice( offset + 2, offset + 8 ) ),
    i = 0,
    plus9 = offset + 9;

  writeHeader( file, 'TRIANGLES', {
    length,
    colors
  } );

  for ( ; i < length; i++ ) {
    fs.appendFile( file, getVertexIndex( buffer.slice( 2 * i + plus9, 2 * ( i + 1 ) + plus9 ) ), ( e ) => {
      if ( e ) throw e;
    } );
  }

  return 9 + length * 2;
}

function writeHeader( file, type, props ) {
  var out = '' + type + '\n';
  for ( prop in props ) {
    out += prop + ':' + props[ prop ] + '\n';
  }
  fs.appendFile( file, out, ( e ) => {
    if ( e ) throw e;
  } );
}

function processFile( file ) {
  const inputFile = file || 'test';

  fs.readFile( inputFile, ( e, data ) => {
    if ( e ) throw e;
    start( data );
  } );
}

function start( buffer ) {
  const outputFile = 'out';
  var inputBuffer = buffer,
    offset = 0,
    group = 0;

  while ( offset < inputBuffer.length ) {
    group = inputBuffer.readUInt8( offset );
    switch ( group ) {
    case 3:
      offset += decodeVertexGroup( outputFile, inputBuffer, offset );
      break;
    case 11:
      offset += decodeTriangleGroup( outputFile, inputBuffer, offset );
      break;
    default:
      console.error( 'Bad group: ', group, ' at offset ', offset );
      process.exit(1);
    }
  }

}

processFile( process.argv[ 2 ] );
