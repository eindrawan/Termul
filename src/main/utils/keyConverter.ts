import { readFileSync } from 'fs';
import { PPKParser } from 'ppk-to-openssh';

// Check if the key is in PuTTY format
function isPuttyKey(keyContent: string): boolean {
  return keyContent.startsWith('PuTTY-User-Key-File-');
}

// Check if the key is in OpenSSH format
function isOpenSSHKey(keyContent: string): boolean {
  return keyContent.trim().startsWith('-----BEGIN');
}

// Check if the key is in SSH2 format (RFC 4716)
function isSSH2Key(keyContent: string): boolean {
  return keyContent.includes('---- BEGIN SSH2 PUBLIC KEY ----') || 
         keyContent.includes('---- BEGIN SSH2 ENCRYPTED PRIVATE KEY ----');
}

// Check if a private key is encrypted
function isKeyEncrypted(keyContent: string): boolean {
  return keyContent.includes('ENCRYPTED') ||
         keyContent.includes('Proc-Type: 4,ENCRYPTED');
}

// Function to attempt to convert PuTTY key to OpenSSH format
async function convertPuttyToOpenSSH(puttyKeyContent: string, passphrase?: string): Promise<string> {
  try {
    // console.log('Converting PPK with passphrase:', passphrase ? 'YES (provided)' : 'NO');

    // Use the ppk-to-openssh library to convert the key
    // Use default PEM format instead of OpenSSH format for better ssh2 compatibility
    // The default parser returns PEM format which ssh2 handles better
    const parser = new PPKParser();

    const result = await parser.parse(puttyKeyContent, passphrase);

    // console.log('PPK conversion result type:', typeof result);
    // console.log('PPK conversion result keys:', result && typeof result === 'object' ? Object.keys(result) : 'N/A');

    // Extract the private key from the result object
    if (!result || typeof result !== 'object' || !result.privateKey) {
      console.error('Unexpected result from ppk-to-openssh:', result);
      throw new Error('Invalid result from PPK conversion library - missing privateKey property');
    }

    let privateKeyString = result.privateKey;

    // // Log the raw key for debugging
    // console.log('Raw converted key (first 200 chars):', privateKeyString.substring(0, 200));
    // console.log('Raw converted key (last 100 chars):', privateKeyString.substring(privateKeyString.length - 100));
    // console.log('Key has \\r\\n:', privateKeyString.includes('\r\n'));
    // console.log('Key has \\n:', privateKeyString.includes('\n'));

    // Ensure proper formatting with correct line endings (Unix style)
    // Replace any Windows line endings with Unix line endings
    privateKeyString = privateKeyString.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Ensure it ends with a newline
    if (!privateKeyString.endsWith('\n')) {
      privateKeyString += '\n';
    }

    // console.log('Formatted key starts with:', privateKeyString.substring(0, 50));
    // console.log('Formatted key length:', privateKeyString.length);
    // console.log('Key fingerprint:', result.fingerprint);

    return privateKeyString;
  } catch (error: any) {
    if (error instanceof Error && error.message?.includes('passphrase')) {
      throw new Error('Incorrect passphrase for encrypted PuTTY key. Please provide the correct passphrase.');
    }
    console.error('PPK conversion error:', error);
    throw new Error(`Failed to convert PuTTY key to OpenSSH format: ${error?.message || error}`);
  }
}

// Detect and handle key format conversion
export async function processPrivateKey(keyPath: string, passphrase?: string): Promise<string> {
  let keyContent: string;
  
  try {
    keyContent = readFileSync(keyPath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read private key file: ${error}`);
  }
  
  // Check if it's a PuTTY key
  if (isPuttyKey(keyContent)) {
    return await convertPuttyToOpenSSH(keyContent, passphrase);
  }
  
 // If it's already in OpenSSH format, return as is
  if (isOpenSSHKey(keyContent)) {
    return keyContent;
  }
  
  // If it's SSH2 format, try to handle it
  if (isSSH2Key(keyContent)) {
    throw new Error(
      'SSH2 format keys are not supported directly. ' +
      'Please convert your key to OpenSSH format using ssh-keygen or PuTTYgen.'
    );
  }
  
  // If none of the above, it might be a malformed key or unsupported format
  throw new Error(
    'Unsupported private key format detected. ' +
    'Supported formats:\n' +
    '- OpenSSH format (starts with "-----BEGIN")\n' +
    '- PuTTY format (.ppk files - requires conversion)\n' +
    '- SSH2 format (requires conversion)\n\n' +
    'Most SSH tools like PuTTYgen can convert between formats: ' +
    'Load your key and export in OpenSSH format.'
  );
}

// Enhanced validation function with better error messages
export async function validateAndFormatPrivateKey(keyPath: string, passphrase?: string): Promise<string> {
  let keyContent: string;
  
  try {
    keyContent = readFileSync(keyPath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read private key file: ${error}`);
  }
  
  // Normalize all types of line endings to \n
  keyContent = keyContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Check key format
  if (isOpenSSHKey(keyContent)) {
    // Standard OpenSSH format - validate the format
    if (!isValidOpenSSHKey(keyContent)) {
      throw new Error('Invalid OpenSSH key format. Key must begin with "-----BEGIN" and end with "-----END".');
    }
    // Ensure proper formatting with correct line endings and ensure it ends with a newline
    return keyContent.trim() + '\n';
  } else if (isPuttyKey(keyContent)) {
    // PuTTY format - convert it to OpenSSH format
    return await convertPuttyToOpenSSH(keyContent, passphrase);
  } else if (isSSH2Key(keyContent)) {
    // SSH2 format - not supported by ssh2 directly
    throw new Error(
      'SSH2 format keys are not supported. ' +
      'Convert to OpenSSH format using PuTTYgen or ssh-keygen.'
    );
  } else {
    // Check if it might be a public key
    if (keyContent.includes('ssh-rsa') || keyContent.includes('ssh-ed25519') || keyContent.includes('ecdsa-sha2')) {
      throw new Error('Detected public key format. Please provide the private key file, not the public key.');
    }
    // Check if it's a Google Cloud Platform specific format
    if (keyContent.includes('google_compute_engine')) {
      throw new Error(
        'Google Cloud Platform SSH keys may need format conversion. ' +
        'Ensure the key is in OpenSSH format (not PuTTY format). ' +
        'Use PuTTYgen to convert if needed: Load your key, then "Conversions" -> "Export OpenSSH key".'
      );
    }
    throw new Error(
      'Unsupported private key format. The key must be in OpenSSH format (starts with "-----BEGIN"). ' +
      'If using a PuTTY (.ppk) key, convert it to OpenSSH format using PuTTYgen: "Conversions" -> "Export OpenSSH key".'
    );
  }
}

// Helper function to validate OpenSSH key format
function isValidOpenSSHKey(keyContent: string): boolean {
  const trimmedKey = keyContent.trim();
  return trimmedKey.startsWith('-----BEGIN') && trimmedKey.endsWith('-----');
}

// Enhanced validation function that also returns whether the key needs a passphrase
export async function validateAndFormatPrivateKeyWithMetadata(
  keyPath: string,
  passphrase?: string
): Promise<{ privateKey: string; needsPassphrase: boolean }> {
  const privateKey = await validateAndFormatPrivateKey(keyPath, passphrase);
  const needsPassphrase = isKeyEncrypted(privateKey);

  // console.log('Key validation complete. Needs passphrase:', needsPassphrase);

  return { privateKey, needsPassphrase };
}

// Additional utility: Function to detect key type (synchronous for compatibility)
export function detectKeyType(keyPath: string): string {
  try {
    const keyContent = readFileSync(keyPath, 'utf8');
    
    if (isPuttyKey(keyContent)) {
      return 'PuTTY (.ppk)';
    } else if (isOpenSSHKey(keyContent)) {
      // Try to determine specific key algorithm
      if (keyContent.includes('-----BEGIN OPENSSH PRIVATE KEY-----')) {
        return 'OpenSSH (new format)';
      } else if (keyContent.includes('-----BEGIN RSA PRIVATE KEY-----')) {
        return 'OpenSSH (RSA)';
      } else if (keyContent.includes('-----BEGIN EC PRIVATE KEY-----')) {
        return 'OpenSSH (ECDSA)';
      } else if (keyContent.includes('-----BEGIN DSA PRIVATE KEY-----')) {
        return 'OpenSSH (DSA)';
      } else {
        return 'OpenSSH (unknown type)';
      }
    } else if (isSSH2Key(keyContent)) {
      return 'SSH2 (RFC 4716)';
    } else {
      return 'Unknown';
    }
  } catch (error) {
    return 'Error reading key file';
  }
}