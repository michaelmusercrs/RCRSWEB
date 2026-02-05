const https = require('https');

async function testImage(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      const contentType = res.headers['content-type'];
      console.log(`\n${res.statusCode === 200 ? '✅' : '❌'} Status: ${res.statusCode}`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   URL: ${url.substring(0, 60)}...`);

      if (res.statusCode === 200 && contentType?.includes('image')) {
        console.log('   🎉 Image is accessible!');
      } else if (res.statusCode === 403) {
        console.log('   ⚠️  Access denied - Make sure image is shared publicly');
      } else {
        console.log('   ⚠️  Not accessible as an image');
      }
      resolve();
    }).on('error', (e) => {
      console.log(`\n❌ Error: ${e.message}`);
      resolve();
    });
  });
}

async function checkImages() {
  const response = await fetch('http://localhost:3000/api/team-members');
  const members = await response.json();

  console.log('🔍 Checking team member images...\n');

  for (const member of members) {
    if (member.profileImage && !member.profileImage.includes('YOUR_GOOGLE_DRIVE')) {
      console.log(`\n👤 ${member.name}:`);
      await testImage(member.profileImage);
    }
  }

  console.log('\n\n💡 Tips:');
  console.log('   1. Make sure images are shared with "Anyone with the link"');
  console.log('   2. Use Google Drive share links or direct uc?id= format');
  console.log('   3. Wait 30 seconds for cache to refresh');
}

checkImages();
