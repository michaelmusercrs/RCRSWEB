import fs from 'fs';

// 1. Services LIST page - remove costRange blocks
let f1 = fs.readFileSync('app/(site)/services/page.tsx','utf8');
f1 = f1.replace(/\s*\{service\.costRange && \(\s*<p className="text-sm font-semibold text-brand-green mb-4">\s*\{service\.costRange\}\s*<\/p>\s*\)\}/g, '');
fs.writeFileSync('app/(site)/services/page.tsx', f1);
console.log('services list: removed. remaining costRange refs:', (f1.match(/costRange/g)||[]).length);

// 2. Services DETAIL page
let f2 = fs.readFileSync('app/(site)/services/[slug]/page.tsx','utf8');
// Remove hero cost display block
f2 = f2.replace(/\s*\{service\.costRange && \(\s*<div className="inline-block[^]*?<\/div>\s*\)\}/m, '');
// Replace cost FAQ with no-price version
f2 = f2.replace(
  /answer: service\.costRange\s*\?[^,]+?,/s,
  `answer: \`The cost of \${service.title.toLowerCase()} varies based on your specific situation. Contact us for a free inspection and detailed quote with no obligation.\`,`
);
fs.writeFileSync('app/(site)/services/[slug]/page.tsx', f2);
console.log('services detail: remaining costRange refs:', (f2.match(/costRange/g)||[]).length);

// 3. Homepage - remove price from FAQ
let f3 = fs.readFileSync('app/(site)/page.tsx','utf8');
f3 = f3.replace(
  /answer: 'A typical residential roof replacement in North Alabama ranges from \$5,000 to \$25,000\+[^']+'/,
  "answer: 'The cost of a new roof depends on the size of your roof, materials chosen, and complexity of the job. We offer free inspections and detailed quotes so you know exactly what to expect — no obligation.'"
);
fs.writeFileSync('app/(site)/page.tsx', f3);
console.log('homepage FAQ: done');

// 4. Check remaining dollar refs in services-related files
let f4 = fs.readFileSync('lib/servicesData.ts','utf8');
console.log('servicesData.ts costRange refs:', (f4.match(/costRange/g)||[]).length);

// 5. Careers page
let f5 = fs.readFileSync('app/(site)/careers/page.tsx','utf8');
const careerPrices = f5.match(/\$\d[\d,K]*/g) || [];
console.log('careers dollar refs:', careerPrices);

// 6. Check FAQSection
let f6 = fs.readFileSync('components/FAQSection.tsx','utf8');
const faqPrices = f6.match(/\$\d[\d,K]*/g) || [];
console.log('FAQSection dollar refs:', faqPrices);

// 7. Check storm check layout
let f7 = fs.readFileSync('app/(site)/check-my-address/layout.tsx','utf8');
const stormPrices = f7.match(/price|cost|\$\d/gi) || [];
console.log('storm check layout price refs:', stormPrices);
