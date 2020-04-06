node (label: 'master') {

  stage('Checkout') {
    if(env.GERRIT_REFSPEC && env.GERRIT_PATCHSET_REVISION) {
      println "Building from Gerrit with Refspec: $GERRIT_REFSPEC and branch $GERRIT_PATCHSET_REVISION"
      checkout([$class: 'GitSCM', branches: [[name: "$GERRIT_PATCHSET_REVISION"]], doGenerateSubmoduleConfigurations: false, extensions: [], submoduleCfg: [], userRemoteConfigs: [[credentialsId: 'gerrit_id_rsa', name: "", refspec: "$GERRIT_REFSPEC", url: 'ssh://rjs@gerrit.eclipsesource.com:29418/tabris-js-cli']]])
    } else {
      git url: 'git@github.com:eclipsesource/tabris-js-cli.git', credentialsId: 'tabris-js-cli_id_rsa'
    }
  }

  /* Requires the Docker Pipeline plugin to be installed */
  docker.image('node:10-alpine').inside {

    def scmInfo

    stage('Checkout') {
      scmInfo = checkout scm
    }

    stage('Install') {
      ansiColor('xterm') {
        sh 'apk update'
        sh 'apk add bash'
        sh 'npm -v'
        sh 'npm ci'
      }
    }

    timeout(time: 10, unit: 'MINUTES')   {
      stage('Test') {
        ansiColor('xterm') {
            sh 'npm test'
        }
      }
    }

  }

}
