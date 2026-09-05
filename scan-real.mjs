import { NodeModulesDetector } from './dist/detectors/index.js';

async function scan() {
  const detector = new NodeModulesDetector();
  const items = await detector.detect();
  
  console.log('\n🔍 REPURGE - Scan Real do seu Mac\n');
  console.log(`Total encontrado: ${items.length} node_modules\n`);
  
  if (items.length === 0) {
    console.log('✅ Nenhum lixo encontrado!');
    return;
  }
  
  items.forEach((item, i) => {
    console.log(`${i + 1}. ${item.path}`);
    console.log(`   Tamanho: ${(item.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Prioridade: ${item.priority}`);
    console.log(`   Razão: ${item.reason}\n`);
  });
}

scan().catch(console.error);
