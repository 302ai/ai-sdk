import { ai302 } from '@302ai/ai-sdk';
import { rerank } from 'ai';
import 'dotenv/config';

const documents = [
  'Organic skincare for sensitive skin with aloe vera and chamomile.',
  'New makeup trends focus on bold colors and innovative techniques.',
  'Bio-Hautpflege für empfindliche Haut mit Aloe Vera und Kamille.',
  '针对敏感肌专门设计的天然有机护肤产品，温和滋润。',
];

async function testRerank() {
  console.log('Testing rerank with Jina model...\n');

  const { ranking, rerankedDocuments } = await rerank({
    model: ai302.reranking('bce-reranker-base_v1'),
    documents,
    query: 'skincare products for sensitive skin',
    topN: 3,
  });

  console.log('Query: "skincare products for sensitive skin"');
  console.log('\nRanking results:');
  ranking.forEach((item, i) => {
    console.log(
      `  ${i + 1}. [Score: ${item.score.toFixed(4)}] ${documents[item.originalIndex].substring(0, 50)}...`,
    );
  });

  console.log('\nReranked documents:');
  rerankedDocuments.forEach((doc, i) => {
    const docStr = typeof doc === 'string' ? doc : JSON.stringify(doc);
    console.log(`  ${i + 1}. ${docStr.substring(0, 60)}...`);
  });
}

async function testRerankWithObjects() {
  console.log('\n--- Testing rerank with object documents ---\n');

  const objectDocs = [
    { title: 'Skincare Guide', content: 'Organic products for sensitive skin' },
    { title: 'Makeup Trends', content: 'Bold colors and techniques' },
    { title: 'Hair Care', content: 'Tips for healthy hair' },
  ];

  const { ranking } = await rerank({
    model: ai302.reranking('bge-reranker-v2-m3'),
    documents: objectDocs,
    query: 'sensitive skin care',
    topN: 2,
  });

  console.log('Query: "sensitive skin care"');
  console.log('\nRanking results:');
  ranking.forEach((item, i) => {
    console.log(
      `  ${i + 1}. [Score: ${item.score.toFixed(4)}] ${objectDocs[item.originalIndex].title}`,
    );
  });
}

async function main() {
  await testRerank();
  await testRerankWithObjects();
}

main().catch(console.error);

