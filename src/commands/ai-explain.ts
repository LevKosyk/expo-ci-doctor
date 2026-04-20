import fs from 'node:fs';
import chalk from 'chalk';
import https from 'node:https';
import { printTitle, printSuccess, printError, printInfo } from '../utils/logger.js';
import { getRuntime } from '../utils/runtime.js';

function callLLM(prompt: string, apiKey: string, provider: 'openai' | 'gemini'): Promise<string> {
  return new Promise((resolve, reject) => {
    if (provider === 'gemini') {
      const data = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      });
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
      }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.candidates?.[0]?.content?.parts?.[0]?.text || 'No explanation generated.');
          } catch (e) {
            reject('Failed to parse Gemini response.');
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    } else {
      const data = JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }]
      });
      const req = https.request({
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(data) 
        }
      }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.choices?.[0]?.message?.content || 'No explanation generated.');
          } catch (e) {
            reject('Failed to parse OpenAI response.');
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    }
  });
}

export async function aiExplainCommand(logfile: string, opts: { apiKey?: string; provider?: 'openai' | 'gemini' }): Promise<void> {
  const runtime = getRuntime();
  if (!runtime.silent) printTitle('expo-ci-doctor ai-explain');

  if (!fs.existsSync(logfile)) {
    console.log(`${chalk.red('✖')} Log file not found at ${logfile}`);
    return;
  }

  const apiKey = opts.apiKey || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    printError('No API key provided. Please pass --api-key <key> or set OPENAI_API_KEY / GEMINI_API_KEY in environment.');
    return;
  }

  const provider = opts.provider || (process.env.GEMINI_API_KEY ? 'gemini' : 'openai');

  const content = fs.readFileSync(logfile, 'utf8');
  // Take last 500 lines roughly
  const lines = content.split('\n');
  const tail = lines.slice(-500).join('\n');

  const prompt = `You are an expert React Native and Expo build diagnostic assistant.
Please analyze the following CI/Build log snippet and explain what the root cause of the error is in plain English, and provide a concrete solution to fix it. Keep it concise.

--- LOG SNIPPET ---
${tail}
-------------------`;

  try {
    printInfo(`Analyzing log using ${provider} AI...`);
    const explanation = await callLLM(prompt, apiKey, provider);
    console.log('\n' + chalk.bold('AI Analysis Result:'));
    console.log(chalk.dim('─────────────────────────────────'));
    console.log(explanation);
    console.log(chalk.dim('─────────────────────────────────\n'));
    printSuccess('Analysis complete.');
  } catch (err: any) {
    printError(`AI Analysis failed: ${err.message || err}`);
  }
}
