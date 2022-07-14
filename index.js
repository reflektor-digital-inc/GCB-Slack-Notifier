const { IncomingWebhook } = require('@slack/webhook');

const SLACK_WEBHOOK_URL = ''; // Enter Your Slack Webhook URL here

const MAP_TRIGGER_NAME_TO_URL = {
  // Put the mapping table here. E.g. 'backend' => 'api.example.com',
}

const webhook = new IncomingWebhook(SLACK_WEBHOOK_URL);

// subscribe is the main function called by Cloud Functions.
module.exports.subscribe = (message, context, callback) => {
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
  const slackMessage = createSlackMessage(build);

  (async () => {
    await webhook.send(slackMessage);
  })();
};

// eventToBuild transforms pubsub event message to a build object.
const messageToBuild = (data) => {
  return JSON.parse(Buffer.from(data, 'base64').toString());
};

// createSlackMessage create a message from a build object.
const createSlackMessage = (build) => {
  let buildId = build.id || '';
  let projectId = build.projectId || '';
  let buildCommit = build.substitutions.COMMIT_SHA || '';
  let branch = build.substitutions.BRANCH_NAME || '';
  let repoName = build.substitutions.REPO_NAME.split('_').pop() || ''; //Get repository name
  let triggerName = build.substitutions.TRIGGER_NAME || '';

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
      ],
    },
    {
      title: `Commit - ${buildCommit}`,
      title_link: `https://github.com/reflektor-digital-inc/${repoName}/commit/${buildCommit}`, // Insert your Organization/Bitbucket/Github Url
      fields: [
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
