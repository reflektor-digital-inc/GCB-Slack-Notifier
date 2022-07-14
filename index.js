const axios = require('axios');
const { IncomingWebhook } = require('@slack/webhook');
const config = require('./config.json');

const SLACK_WEBHOOK_URL = config.slack_webhook_url;

const GITHUB_ACCESS_TOKEN = config.github_access_token;

const MAP_TRIGGER_NAME_TO_URL = config.trigger_name_to_url_mapping;

const webhook = new IncomingWebhook(SLACK_WEBHOOK_URL);

// subscribe is the main function called by Cloud Functions.
module.exports.subscribe = async (message, context, callback) => {
  const build = messageToBuild(message.data);

  // Skip if the current status is not in the status list.
  // Add additional statues to list if you'd like:
  // SUCCESS, FAILURE, INTERNAL_ERROR
  // TIMEOUT, CANCELLED
  const status = [
    'SUCCESS',
    'FAILURE',
    'INTERNAL_ERROR',
    'TIMEOUT',
    'CANCELLED',
  ];

  if (status.indexOf(build.status) === -1) {
    if (typeof callback === 'function') {
      return callback();
    }
    return;
  }

  // Send message to Slack.
  const slackMessage = await createSlackMessage(build);

  (async () => {
    await webhook.send(slackMessage);
  })();
};

// eventToBuild transforms pubsub event message to a build object.
const messageToBuild = (data) => {
  return JSON.parse(Buffer.from(data, 'base64').toString());
};

// createSlackMessage create a message from a build object.
const createSlackMessage = async (build) => {
  let buildId = build.id || '';
  let projectId = build.projectId || '';
  let buildCommit = build.substitutions.COMMIT_SHA || '';
  let branch = build.substitutions.BRANCH_NAME || '';
  let repoName = build.substitutions.REPO_NAME.split('_').pop() || ''; //Get repository name
  let triggerName = build.substitutions.TRIGGER_NAME || '';

  let commitMessage = '';
  let commitAuthor = '';

  // Get the commit message using GitHub API
  await axios.get(
    `https://api.github.com/repos/reflektor-digital-inc/${repoName}/git/commits/${buildCommit}`,
    {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `token ${GITHUB_ACCESS_TOKEN}`,
      },
    },
  ).then((response) => {
    commitMessage = response.data.message;
    commitAuthor = response.data.author.name;
  }).catch((error) => {
    console.error(error);
    commitMessage = '[ERROR WHILE FETCJING COMMIT INFO]';
  });

  const attachments = [
    {
      title: 'View Build Logs',
      title_link: build.logUrl,
      fields: [
        {
          title: 'Status',
          value: build.status,
        },
        {
          title: 'Environment',
          value: `\`${projectId}\``,
        },
        {
          title: 'Trigger',
          value: `\`${triggerName}\``,
        },
      ],
    },
    {
      title: `Commit - ${buildCommit}`,
      title_link: `https://github.com/reflektor-digital-inc/${repoName}/commit/${buildCommit}`, // Insert your Organization/Bitbucket/Github Url
      fields: [
        {
          title: 'Message',
          value: `*${commitMessage}*`,
        },
        {
          title: 'Author',
          value: commitAuthor,
        },
        {
          title: 'Branch',
          value: branch,
        },
        {
          title: 'Repository',
          value: repoName,
        },
      ],
    },
  ];

  if (MAP_TRIGGER_NAME_TO_URL.hasOwnProperty(triggerName)) {
    attachments.push({
      title: 'View Website',
      title_link: MAP_TRIGGER_NAME_TO_URL[triggerName],
    });
  }

  let message = {
    text: `Build - \`${buildId}\``,
    mrkdwn: true,
    attachments,
  };
  
  return message;
};
