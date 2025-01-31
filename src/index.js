// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, collection, getDocs, setDoc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import AWS from 'aws-sdk';

// SHOULD BE SYNCED WITH OTHER PROJECTS USING IMAGES AND THUMBNAILS
const THUMBNAIL_PREFIX = "thumb-"

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAHdPBt_onC3s43YXlnsxgik8iwDjrfkt4",
  authDomain: "disco-2ac9d.firebaseapp.com",
  projectId: "disco-2ac9d",
  storageBucket: "disco-2ac9d.appspot.com",
  messagingSenderId: "797784164653",
  appId: "1:797784164653:web:a83ab4e80b71a49d5f6ba4",
  measurementId: "G-BENT8C8D1N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);
// Initialize Firestore instead of Realtime Database
const db = getFirestore(app);

const S3_ENDPOINT = "storage-221.s3hoster.by";
const S3_ACCESS_KEY_ID = "9EYXOVHMB8GQPEU9ZHCY";
const BUCKET_NAME = "main-bucket";
// Initialize S3 client with empty secret - will be set when needed
const s3 = new AWS.S3({
  accessKeyId: S3_ACCESS_KEY_ID,
  secretAccessKey: "", // Will be set before S3 operations
  endpoint: S3_ENDPOINT,
  s3ForcePathStyle: true,
});

async function signIn(password) {
  const statusElement = document.getElementById('status')

  const email = 'listowka.discount@gmail.com'

  return signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      // Signed in
      const user = userCredential.user;
      console.log('user',user)
      return user
    })
    .catch((error) => {
      console.log('error',error)

      statusElement.innerText = `AUTHENTICATION FAILED, POSSIBLY WRONG PASSWORD...`
      statusElement.style.borderColor = 'tomato'
    });
}


async function showShops() {
  const statusElement = document.getElementById('status')
  const passwordElement = document.getElementById('password')
  
  const user = await signIn(passwordElement.value)
  if (!user) {
    return
  }

  // Verify user is authenticated and has correct email
  if (user.email !== 'listowka.discount@gmail.com') {
    statusElement.innerText = `Unauthorized email address!!!`
    statusElement.style.borderColor = 'tomato'
    return
  }

  try {
    // Get all documents from shops collection
    const shopsSnapshot = await getDocs(collection(db, 'shops'));

    if (!shopsSnapshot.empty) {
      const shopsSelect = document.getElementById('shops-list');
      
      shopsSnapshot.forEach((doc) => {
        const shopId = doc.id;
        shopsSelect.add(new Option(shopId, shopId));
      });

      statusElement.innerText = `Shops are loaded! 🛒`
      statusElement.style.borderColor = 'darkgreen'

      setTimeout(() => {
        statusElement.innerText = `Choose Shop and fill in Discount data -> click Save`
        statusElement.style.borderColor = 'blue'
      }, 3e3)

    } else {
      statusElement.innerText = `NO SHOPS AVAILABLE...`
      statusElement.style.borderColor = 'tomato'
    }
  } catch(error) {
    console.log("SHOPS LOADING ERROR:", error)
    statusElement.innerText = `Shops loading Error: ${error}`
    statusElement.style.borderColor = 'tomato'
  }
}

async function onSave () {
  // First verify authentication
  const user = auth.currentUser;
  const statusElement = document.getElementById('status')

  console.log('Current user:', user);
  console.log('User email:', user?.email);
  console.log('Is user authenticated?', !!user);

  if (!user || user.email !== 'listowka.discount@gmail.com') {
    statusElement.innerText = `Not authenticated or unauthorized email. Please sign in first.`
    statusElement.style.borderColor = 'tomato'
    return
  }

  const selectedShopId = document.getElementById('shops-list').value;
  console.log('selectedShopId',selectedShopId)

  const previewUrl = document.getElementById('preview-url').value
  const imagesUrls = [...document.querySelectorAll('.image-url')]
    .filter(e => !!e.value)
    // Replace S3 url to CloudFront CDN url
    .map(e => e.value.replace('https://listowka-disco.s3.eu-central-1.amazonaws.com/', 'https://d83qhhedg12j5.cloudfront.net/'))

  console.log('CHECK that s3 urls are replaced to cdn urls:')
  console.log('imagesUrls',imagesUrls)
    
  const dateStart = document.getElementById('date-start').value
  const dateEnd = document.getElementById('date-end').value
  const shouldNotify = document.getElementById('should-notify').checked

  const discountPayload = {
    dateStart, 
    dateEnd, 
    previewUrl, 
    imagesUrls, 
    shopId: selectedShopId,
    shouldNotify
  }
  console.log('discountPayload',discountPayload)

  if (!validate({...discountPayload})) {
    return
  }

  try {
    const discountId = generateHexadecimalHash(24)

    console.log('Attempting to write with user:', user.email);
    console.log('Writing discount with ID:', discountId);
    console.log('Payload:', discountPayload);
    
    await setDoc(doc(db, 'discounts', discountId), discountPayload);

    // Update shop's discounts array
    const shopRef = doc(db, 'shops', selectedShopId);
    await updateDoc(shopRef, {
      discounts: arrayUnion(discountId)
    });

    statusElement.innerText = `Success! 😎 Discount is saved and attached to the shop 🛍️`
    statusElement.style.borderColor = 'darkgreen'

    clearAllFields()
  } catch (e) {
    console.log('e',e)
    statusElement.innerText = `Error: ${e}`
    statusElement.style.borderColor = 'tomato'
  }
}

function validate({dateStart, dateEnd, imagesUrls, shopId}) {
  const statusElement = document.getElementById('status')

  if (!shopId) {
    statusElement.innerText = `🏬️ Choose a Shop!`
    statusElement.style.borderColor = 'tomato'
    return false
  }

  if (!dateStart || !dateEnd || !isValidDateFormat(dateStart) || !isValidDateFormat(dateEnd)) {
    statusElement.innerText = `📅️ Something wrong with Dates - empty or wrong format!`
    statusElement.style.borderColor = 'tomato'
    return false
  }

  if (!imagesUrls || !imagesUrls.length) {
    statusElement.innerText = `🔗 At least one Discount Url Image needed!`
    statusElement.style.borderColor = 'tomato'
    return false
  }

  return true
}

function generateHexadecimalHash(length) {
  let result = '';
  const characters = 'abcdef0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

function addInput() {
  const container = document.getElementById('inputs-container')
  const newInput = document.createElement('input')
  newInput.className = 'image-url'
  newInput.style.display = "block"
  newInput.style.width = '800px'
  newInput.style.marginBottom = '5px'

  container.appendChild(newInput)
  return newInput
}

function clearAllFields() {
  [...document.querySelectorAll('.image-url')].forEach(elem => elem.value = '')
  document.getElementById('date-start').value = '';
  document.getElementById('date-end').value = '';
  document.getElementById('shops-list').value = '';
  document.getElementById('preview-url').value = '';
  document.getElementById('should-notify').checked = true;
  document.getElementById('copy-images-folder-name').value = '';

  const statusElement = document.getElementById('status')
  setTimeout(() => {
    statusElement.innerText = `Choose Shop 🏬and fill in Discount data  -> click Save`
    statusElement.style.borderColor = 'blue'
  }, 2e3)
}

function isValidDateFormat(dateString) {
  // Regular expression for matching the "YYYY-MM-DD" format
  const regex = /^\d{4}-\d{2}-\d{2}$/;

  // Test the dateString against the regex
  if (regex.test(dateString)) {
    // Additional check to ensure the date is valid (e.g., not "2023-02-30")
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  return false;
}

// Add event listeners to update images folder name
document.getElementById('shops-list').addEventListener('change', updateImagesFolderName);
document.getElementById('date-start').addEventListener('change', updateImagesFolderName);
document.getElementById('date-end').addEventListener('change', updateImagesFolderName);

function updateImagesFolderName() {
  const shopId = document.getElementById('shops-list').value;
  const dateStart = document.getElementById('date-start').value;
  const dateEnd = document.getElementById('date-end').value;
  
  const copyText = document.getElementById('copy-images-folder-name');
  copyText.value = [shopId, dateStart, dateEnd].filter(Boolean).join('_');
}

async function loadImagesFromS3() {
  const button = document.getElementById('load-images-button');
  const textSpan = document.getElementById('load-images-text');
  const loaderSpan = document.getElementById('load-images-loader');
  
  const folderName = document.getElementById('copy-images-folder-name').value;
  const s3Secret = document.getElementById('s3-secret').value;
  
  if (!s3Secret) {
    const statusElement = document.getElementById('status');
    statusElement.innerText = `Please enter S3 Secret Key!`;
    statusElement.style.borderColor = 'tomato';
    return;
  }

  if (!folderName) {
    const statusElement = document.getElementById('status');
    statusElement.innerText = `Please select shop and dates first to generate folder name!`;
    statusElement.style.borderColor = 'tomato';
    return;
  }

  try {
    // Update S3 client with the secret key - modified to update credentials properly
    s3.config.update({
      credentials: new AWS.Credentials({
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: s3Secret
      })
    });

    // Show loader
    button.disabled = true;
    textSpan.style.display = 'none';
    loaderSpan.style.display = 'inline';

    const params = {
      Bucket: BUCKET_NAME,
      Prefix: folderName + '/'
    };

    const data = await s3.listObjectsV2(params).promise();
    
    if (!data.Contents || data.Contents.length === 0) {
      console.log(`No images found in folder: ${folderName}`);
      return;
    }

    // Get URLs excluding thumbnails and folders
    const urls = data.Contents
      .map(item => `https://${S3_ENDPOINT}/${BUCKET_NAME}/${item.Key}`)
      .filter(url => !url.endsWith('/')) // Filter out folder itself
      .filter(url => !url.includes(THUMBNAIL_PREFIX)); // Filter out thumbnails

    // Clear existing inputs
    const container = document.getElementById('inputs-container');
    container.innerHTML = '';

    // Set the first URL as preview URL
    if (urls.length > 0) {
      document.getElementById('preview-url').value = urls[0];
    }

    // Create and populate inputs for each URL using existing addInput function
    urls.forEach(url => {
      const input = addInput();
      input.value = url;
    });

    console.log(`Populated ${urls.length} image URLs`);

  } catch (error) {
    console.error('Error loading images from S3:', error);
    const statusElement = document.getElementById('status');
    statusElement.innerText = `Error loading images: ${error.message}`;
    statusElement.style.borderColor = 'tomato';
  } finally {
    // Hide loader and restore button
    button.disabled = false;
    textSpan.style.display = 'inline';
    loaderSpan.style.display = 'none';
  }
}

// Add to window object
window.showShops = showShops;
window.clearAllFields = clearAllFields;
window.addInput = addInput;
window.onSave = onSave;
window.updateImagesFolderName = updateImagesFolderName;
window.loadImagesFromS3 = loadImagesFromS3;