import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
let html=await readFile(path.join(root,'index.html'),'utf8');
const css=await readFile(path.join(root,'styles.css'),'utf8');
html=html.replace('<link rel="stylesheet" href="styles.css">','<style>\n'+css+'\n</style>');
const scripts=[];
for(const name of ['data.js','engine.js','theater.js','app.js']){
  const source=await readFile(path.join(root,name),'utf8');
  html=html.replace('  <script defer src="'+name+'"></script>\n','');
  scripts.push('<script>\n'+source.replaceAll('</script','<\\/script')+'\n</script>');
}
html=html.replace('href="./index.html"','href="#"').replace('</body>',scripts.join('\n')+'\n</body>');
await mkdir(path.join(root,'dist'),{recursive:true});
await writeFile(path.join(root,'dist','index.html'),html,'utf8');
console.log('Standalone HTML: '+path.join(root,'dist','index.html'));
