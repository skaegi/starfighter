Node Starfighter - Interconnect 2016
-------------------------------

Level up Your Game by Using Application Health Analytics and Test Automation
----------------------------------------------------------------------------

<a href="https://bluemix.net/deploy?repository=https://github.com/skaegi/starfighter" alt="Deploy to Bluemix" target="_blank"><img src="https://bluemix.net/deploy/button.png"></img></a>

In this lab, you will be cloning your own copy of our Starfighter application, a multiplayer shoot-em-up powered by IBM MessageSight.  We'll outline the steps to deploy the code to IBM Bluemix and monitor the application's health using New Relic.

Deploying to Bluemix
--------------------

1. To get started, first browse to the starfighter application's [git repository](https://github.com/skaegi/starfighter).
1. Next, click on the <a href="https://bluemix.net/deploy?repository=https://github.com/skaegi/starfighter" alt="Deploy to Bluemix" target="_blank"><img src="https://bluemix.net/deploy/button.png"></img></a> button.
1. If you do not already have a Bluemix account, getting one is quick and easy.  Just click on the _Sign up_ link.  If you already have an account, click on the _Login_ button to sign in.
1. After logging in, simply click on _Deploy_ to deploy your app.
1. If you want up to the minute status on your deployment, click on the _Configured pipeline successfully_ link to view the status of your brand new deployment pipeline *in a new tab*.  _Keep this tab open for later._
1. Once the deployment is complete, click on the the _View Your App_ link to browse to your brand new running app *in a new tab*.  Play a few games and see if you get a high score.  When you're done, close this tab to return to the *Deploy to Bluemix* page to continue.
1. Remember that this app is instrumented with _New Relic_, and it has already begun collecting valuable application health statistics.  To open up the New Relic dashboard, *open a new browser tab* and browse to [your Bluemix dashboard](https://console.ng.bluemix.net/#/resources), click on your _New Relic_ service instance, and then on _Open New Relic Dashboard_.
1. Here you can view information on your application's performance and health, including average request latency, throughput, response time, memory and CPU usage.
1. When you're done monitoring your app, return to the *Deploy to Bluemix* tab to continue.


Source Code Management
----------------------

As you have learned, setting up an application instrumented with health analytics is as easy as a few button clicks and takes only a few moments.  In addition to spinning up the application, the _Deploy to Bluemix_ button also set up a Git source control repository that you and your team can use to collaborate on changes to your codebase.

Although you're free to use any Git client or IDE to edit code and share changes, follow along to use the IBM DevOps Services Web IDE:

1. If you haven't already done so, return to the tab with *Deploy to Bluemix*, and click on the _Created project successfully_ link.  If you happened to close this tab, first browse to your Bluemix dashboard, then click on your brand new _Starfighter_ app, then click on the _Git Repo_ link.
1. Welcome to your DevOps Services project page.  To edit the code for your new project, click on the _Edit Code_ button along the top of the page to bring up the _Web IDE_.
1. Choose a file to edit using the file system viewer on the left.  For your first change, choose `public/index.html`.
1. Use the pane on the right as you would any text editor.  For your first change, edit line 91 and replace `Hello Interconnect` with a message of your choosing.  Without getting too much into how HTML works, make sure what you enter is a simple message composed of letters and numbers.  So you never lose your painstakingly written code changes, the Web IDE auto-saves a few moments after you each edit.  When you're done editing, simple move onto the next step.
1. In Git, the smallest unit of change to source files is a commit.  To make one, click on the Git icon along the left side of the browser to bring up the `Git Repository` view.
1. Enter a descriptive commit message, and select the files you would like to include in your first commit.  In this case, it's safe to click on the _Select all_ checkbox.
1. Click on Commit to create a commit in your personal Git repository.
1. Another Git tidbit is that it's distributed.  The commit you made above was recorded in your own personal Git repository hosted by the Web IDE.  In order to make this commit available to your team, you need to first _push_ it to your project's master branch.  To do so, click on the _Push_ button on the left hand pane of your browser.

Just to recap, you have just made a code edit, recorded it in your own personal Git repository and made the change available to your team by pushing it to your project's master branch.  Continue on to learn how one tireless member of your team, the Continuous Delivery Pipeline can bring these code changes to life.


Continous Deployment
--------------------

Way back when you used _Deploy to Bluemix_, a secret team member was added to your project: A continuous deployment pipeline.  A very important one of its jobs is to look for code changes and deploy them to your Bluemix application.  This process is fully customizable, but to get you going, _Deploy to Bluemix_ created a pair of stages that fetches code from the `master` branch and deploys it to your Bluemix application.  In fact, that commit you just pushed launched your pipeline into action.

To view the pipeline as it redeploys your application: 

1. From the _Web IDE_, click on the _Build and Deploy_ button near the top-right of your browser to bring up your project's deliver pipeline.
1. This pipeline is composed of a two stages:  One that fetches your code from your project's Git repository, and another that deploys that code to your application in Bluemix.  Feel free to explore your pipeline, but keep an eye on the Deploy stage.  Proceed when it completes.
1. When your app has been redeployed, click on the link in the _Deploy_ stage to view your changes.


Use your own Tools and Git Workflow
-----------------------------------

As hinted at above, you are in no way limited to using the _Web IDE_ to make code changes or manage your Git repository.  In fact, you can use any Git client and any IDE or Text Editor.  All you need is your project's Git repository URL.  To determine this: 

- First browse to your project's overview page.  From the _Web IDE_, this can be done by clicking on your project's name above, and to the right of the page.
- Once on the Project Overview page, click on the Git URL link above and to the right of the source code preview.

Tips:

- Depending on the visibility of your project, your Git client may ask for a username and password when fetching source or pushing changes.  When prompted, enter the credentials you used to log into IDS.  If you prefer, when prompted for your _uesrname_ you may also substitute the short name you used while registering with Bluemix in place of your IBM ID email address.
- As with the _Web IDE_, triggering the continuous delivery pipeline is a matter of performing a `git push` to your project's `master` branch.


Customizing the Delivery Pipeline
---------------------------------

The delivery pipeline created above by the _Deploy to Bluemix Button_ is a very simple one that can be customized to suit your project's individual needs.  Here are some tips on customizations you may want to make.  Keep them in mind as you explore your project's *Build and Deploy* page.

Tips:

- The provided pipeline assumes a codebase that can be run directly by a runtime environment and without any special preprocessing.  For build-masters familiar with `bash` scripting, this simple build can be customized with a user provided script, either entered directly into the Pipeline, or checked into the `master branch` of your project.  There are also structured builders for builds automated using common build tools like, `npm`, `grunt`, and `ant`.  Edit your pipeline's _Build_ stage and open the _Builder_ drop-down to explore the available options.
- Earlier, we described how the delivery pipeline is triggered by changes to your project's `master` branch.  In case you would prefer to monitor another branch, edit your pipeline's _Build_ stage.  Also, teams whose process requires manual deployments may disable automated builds and deployments altogether by editing this stage. 
- Many development teams prefer a staged deployment process.  An example would include, an automated build, and an initial automated deployment to an _unstable_ Bluemix application.  After quality assurance tests or other automated or manual processes, another deployment using the same build would then target another Bluemix application, used in _production_.  Modelling this workflow in a pipeline involves adding additional stages with _Deploy_ and/or _Test_ steps.  There are several examples of more complex pipelines in public projects.  For example, see <a href='javascript:void(0)'>danberg</a>'s [Cloud Trader](https://hub.jazz.net/pipeline/danberg/CloudTrader) for an example of an pipeline with several using a varierty of automated and manual gates.

As a final note, remember that the steps in a delivery pipeline may be backed by a simple shell script of your choosing.  Also, these scripts are run in an environment preloaded with  a full compliment of POSIX standard UNIX utilities as well as:

- Common utilities like `curl`, and `git`.
- Build automation utilities like `grunt`, `gulp`, and `ant`.
- Runtime environments commonly used to automate builds like `perl`, `node`, and `ruby`.

Especially for seasoned build masters, instrumenting a pipeline with external services like Slack, Saucelabs and GitHub is pretty simple.  For more information and tips, see our page on [Toolchains](https://www.ibm.com/devops/method/toolchains/).


What's in Your Pipeline?
------------------------

At the core of our mission on IBM DevOps Services is the concept of...you guessed it...DevOps!

In its purest sense, DevOps describes a *direction* that all facets of a development shop *can move towards* to rapidally increment on client value through software.  Its form is a collection of best practices and  cultural norms.  A generally accepted and overarching theme under this umbrella is the need to share ideas; both on problems faced by practitioners in our field and on the solutions we develop to work through them.  As we navigate our DevOps journey, we will make sure to collect and share our best practices in the [IBM Garage Method](https://www.ibm.com/devops/method).

To reach out to me and my team on how your development shop solves problems using IDS and the Delivery Pipeline please [reach out to me on Twitter](https://twitter.com/skaegi) or grab ahold of me or one of my squadmates!




