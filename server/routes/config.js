import { Router } from 'express';
import { getConfig } from '../models/User.js';

const router = Router();

router.get('/overtime-threshold', (req, res) => {
  const threshold = parseFloat(getConfig('overtime_threshold', '22466.74')) || 21900;
  res.json({ threshold });
});

import { exec } from 'child_process';

// Paste this right before the final export line of config.js
router.post('/git-deploy-webhook-xyz', (req, res) => {
    if (req.body.ref === 'refs/heads/main') {
        console.log('Push detected on main branch. Starting automated deployment...');
        
        // Adjust these to match your exact server directory paths
        const repoPath = '/home/YOUR_CPANEL_USERNAME/repositories/ai-app';
        const appPath = '/home/YOUR_CPANEL_USERNAME/ai-app';

        exec(`cd ${repoPath} && git pull origin main`, (err, stdout, stderr) => {
            if (err) {
                console.error(`Git pull error: ${stderr}`);
                return res.status(500).send('Git pull failed');
            }
            
            // Trigger cPanel's build agent to process your .cpanel.yml tasks 
            exec(`uapi VersionControl deployment trigger repository='ai-rag-app'`, (deployErr, deployStdout) => {
                if (deployErr) {
                    console.error(`cPanel deploy error: ${deployStdout}`);
                    return res.status(500).send('cPanel deployment task tripped.');
                }
                
                res.status(200).send('Deployment complete. Restarting application core...');
                
                // Gracefully cycle the node process so cPanel restarts it with fresh files
                setTimeout(() => { process.exit(0); }, 1000); 
            });
        });
    } else {
        res.status(200).send('Ignored branch modification.');
    }
});

export default router;
