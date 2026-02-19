/**
 * Bible Verse API
 * GET /api/bible-verse
 * Returns a random inspirational verse for Monday meetings.
 */

import { NextResponse } from 'next/server';

const verses = [
  { reference: 'Proverbs 16:3', text: 'Commit to the LORD whatever you do, and he will establish your plans.' },
  { reference: 'Colossians 3:23', text: 'Whatever you do, work at it with all your heart, as working for the Lord, not for human masters.' },
  { reference: 'Philippians 4:13', text: 'I can do all things through Christ who strengthens me.' },
  { reference: 'Proverbs 12:24', text: 'Diligent hands will rule, but laziness ends in forced labor.' },
  { reference: 'Isaiah 40:31', text: 'But those who hope in the LORD will renew their strength. They will soar on wings like eagles; they will run and not grow weary, they will walk and not be faint.' },
  { reference: 'Jeremiah 29:11', text: 'For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future.' },
  { reference: 'Proverbs 27:17', text: 'As iron sharpens iron, so one person sharpens another.' },
  { reference: 'Ecclesiastes 4:9', text: 'Two are better than one, because they have a good return for their labor.' },
  { reference: 'Galatians 6:9', text: 'Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up.' },
  { reference: 'Joshua 1:9', text: 'Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged, for the LORD your God will be with you wherever you go.' },
  { reference: 'Proverbs 3:5-6', text: 'Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.' },
  { reference: 'Romans 8:28', text: 'And we know that in all things God works for the good of those who love him, who have been called according to his purpose.' },
  { reference: 'Psalm 90:17', text: 'May the favor of the Lord our God rest on us; establish the work of our hands for us — yes, establish the work of our hands.' },
  { reference: 'Proverbs 14:23', text: 'All hard work brings a profit, but mere talk leads only to poverty.' },
  { reference: 'Deuteronomy 28:12', text: 'The LORD will open the heavens, the storehouse of his bounty, to send rain on your land in season and to bless all the work of your hands.' },
  { reference: 'Psalm 37:5', text: 'Commit your way to the LORD; trust in him and he will do this.' },
  { reference: 'Proverbs 22:29', text: 'Do you see someone skilled in their work? They will serve before kings; they will not serve before officials of low rank.' },
  { reference: 'Matthew 5:16', text: 'In the same way, let your light shine before others, that they may see your good deeds and glorify your Father in heaven.' },
  { reference: '1 Corinthians 15:58', text: 'Therefore, my dear brothers and sisters, stand firm. Let nothing move you. Always give yourselves fully to the work of the Lord, because you know that your labor in the Lord is not in vain.' },
  { reference: 'Psalm 128:2', text: 'You will eat the fruit of your labor; blessings and prosperity will be yours.' },
  { reference: 'Proverbs 10:4', text: 'Lazy hands make for poverty, but diligent hands bring wealth.' },
  { reference: 'Hebrews 6:10', text: 'God is not unjust; he will not forget your work and the love you have shown him as you have helped his people and continue to help them.' },
  { reference: 'Psalm 34:10', text: 'The lions may grow weak and hungry, but those who seek the LORD lack no good thing.' },
  { reference: 'Proverbs 11:25', text: 'A generous person will prosper; whoever refreshes others will be refreshed.' },
  { reference: 'Matthew 6:33', text: 'But seek first his kingdom and his righteousness, and all these things will be given to you as well.' },
  { reference: 'Psalm 1:3', text: 'That person is like a tree planted by streams of water, which yields its fruit in season and whose leaf does not wither — whatever they do prospers.' },
  { reference: 'Proverbs 13:4', text: 'A sluggard\'s appetite is never filled, but the desires of the diligent are fully satisfied.' },
  { reference: 'Ephesians 4:16', text: 'From him the whole body, joined and held together by every supporting ligament, grows and builds itself up in love, as each part does its work.' },
  { reference: '2 Timothy 2:15', text: 'Do your best to present yourself to God as one approved, a worker who does not need to be ashamed and who correctly handles the word of truth.' },
  { reference: 'Psalm 20:4', text: 'May he give you the desire of your heart and make all your plans succeed.' },
  { reference: 'James 1:12', text: 'Blessed is the one who perseveres under trial because, having stood the test, that person will receive the crown of life that the Lord has promised to those who love him.' },
  { reference: 'Nehemiah 4:6', text: 'So we rebuilt the wall till all of it reached half its height, for the people worked with all their heart.' },
  { reference: 'Proverbs 21:5', text: 'The plans of the diligent lead to profit as surely as haste leads to poverty.' },
  { reference: '2 Chronicles 15:7', text: 'But as for you, be strong and do not give up, for your work will be rewarded.' },
  { reference: 'Psalm 115:14', text: 'May the LORD cause you to flourish, both you and your children.' },
  { reference: 'Proverbs 18:16', text: 'A gift opens the way and ushers the giver into the presence of the great.' },
  { reference: 'Romans 12:11', text: 'Never be lacking in zeal, but keep your spiritual fervor, serving the Lord.' },
  { reference: 'Psalm 23:1', text: 'The LORD is my shepherd, I lack nothing.' },
  { reference: 'Philippians 2:3-4', text: 'Do nothing out of selfish ambition or vain conceit. Rather, in humility value others above yourselves, not looking to your own interests but each of you to the interests of the others.' },
  { reference: 'Proverbs 15:22', text: 'Plans fail for lack of counsel, but with many advisers they succeed.' },
  { reference: 'Isaiah 41:10', text: 'So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you; I will uphold you with my righteous right hand.' },
  { reference: 'Psalm 46:1', text: 'God is our refuge and strength, an ever-present help in trouble.' },
  { reference: 'Proverbs 24:27', text: 'Put your outdoor work in order and get your fields ready; after that, build your house.' },
  { reference: 'Matthew 7:7', text: 'Ask and it will be given to you; seek and you will find; knock and the door will be opened to you.' },
  { reference: 'Psalm 126:5', text: 'Those who sow with tears will reap with songs of joy.' },
  { reference: '1 Thessalonians 5:11', text: 'Therefore encourage one another and build each other up, just as in fact you are doing.' },
  { reference: 'Proverbs 16:9', text: 'In their hearts humans plan their course, but the LORD establishes their steps.' },
  { reference: 'Hebrews 12:1', text: 'Therefore, since we are surrounded by such a great cloud of witnesses, let us throw off everything that hinders and the sin that so easily entangles. And let us run with perseverance the race marked out for us.' },
  { reference: 'Psalm 118:24', text: 'The LORD has done it this very day; let us rejoice today and be glad.' },
  { reference: 'Proverbs 4:25-26', text: 'Let your eyes look straight ahead; fix your gaze directly before you. Give careful thought to the paths for your feet and be steadfast in all your ways.' },
];

export async function GET() {
  const verse = verses[Math.floor(Math.random() * verses.length)];
  return NextResponse.json({ success: true, verse });
}
