var challenges_basic = new function() {
  World_Base.call(this);
  this.parent = {};
  for (p in this) {
    this.parent[p] = this[p];
  }

  var self = this;

  this.name = 'challenges_basic';
  this.shortDescription = 'Basic Challenges';
  this.longDescription =
    '<p>This world contains various challenges.</p>' +
    '<p>A completion code is issued for each completed challenge. This can be used to track students progress.</p>';
  this.thumbnail = 'images/worlds/challenge.jpg';
// ADD WORLD BELOW HERE
  this.optionsConfigurations = [
    {
      option: 'jsonFile',
      title: 'Select Challenges',
      type: 'select',
      options: [
        ['BIFROST 1: First Steps', 'worlds/challenges_basic/bifrost-1.json?v=1'],
        ['BIFROST 2: Long Straight', 'worlds/challenges_basic/bifrost-2.json?v=1'],
        ['BIFROST 3: First Turn', 'worlds/challenges_basic/bifrost-3.json?v=1'],
        ['BIFROST 4: Two Turns', 'worlds/challenges_basic/bifrost-4.json?v=1'],
        ['BIFROST 5: Checkpoints', 'worlds/challenges_basic/bifrost-5.json?v=1'],
        ['BIFROST 6: Loop Route', 'worlds/challenges_basic/bifrost-6.json?v=1'],
        ['BIFROST 7: Final Route', 'worlds/challenges_basic/bifrost-7.json?v=1'],
      ]
    },
    {
      option: 'useDefaultRobot',
      title: 'Use default robot',
      type: 'checkbox',
      label: 'Use the default robot for each challenge. If on, you will not be able to change the robot.',
      help: 'If you want to use your own robot, uncheck this option.'
    },
  ];

  this.defaultOptions = Object.assign(this.defaultOptions, {
    jsonFile: this.optionsConfigurations[0].options[0][1],
    useDefaultRobot: true
  });

  // Set options, including default
  this.setOptions = function(options) {
    options = options || self.defaultOptions;

    return fetch(options.jsonFile)
      .then(response => response.json())
      .then(function(data){
        self.options = {...self.defaultOptions};
        Object.assign(self.options, data.options);
        Object.assign(self.options, options);

        let isBifrostLevel = self.options.jsonFile.match(/bifrost-[1-7]\.json/);
        if (typeof blockly != 'undefined' && isBifrostLevel) {
          if (typeof blockly.workspace != 'undefined' && blockly.workspace.getAllBlocks().length <= 1) {
            blockly.loadDefaultWorkspace();
          }

          let allowedCategories = ['Movement'];

          if (
            self.options.jsonFile.includes('bifrost-2')
            || self.options.jsonFile.includes('bifrost-5')
            || self.options.jsonFile.includes('bifrost-6')
            || self.options.jsonFile.includes('bifrost-7')
          ) {
            allowedCategories.push('Loops');
          }
          if (self.options.jsonFile.includes('bifrost-6') || self.options.jsonFile.includes('bifrost-7')) {
            allowedCategories.push('Control');
          }
          if (self.options.jsonFile.includes('bifrost-7')) {
            allowedCategories.push('Logic');
          }

          let allCategories = ['Motion', 'Motor', 'Sensors', 'Sound', 'Pen', 'Experimental', 'Control', 'Logic', 'Loops', 'Math', 'Text', 'Lists', 'Variables', 'Functions'];
          let filter = {
            deny: {
              categories: allCategories.filter(category => !allowedCategories.includes(category))
            },
            show: {
              categories: allowedCategories
            }
          };

          blockly.loadToolboxFilter(filter);
        }

        return self.parent.setOptions(self.options);
      });
  };

  // Run on page load
  this.init = function() {
    Object.assign(self.options, self.defaultOptions);
    self.audio = $('<audio src="audio/fanfare.mp3" preload="auto"></audio>');
    $('body').append(self.audio);
  };

  this.playVictory = function() {
    self.audio[0].play();
  };

  this.loadNextBifrostLevel = function() {
    let match = self.options.jsonFile.match(/bifrost-([1-7])\.json/);
    if (!match) {
      return false;
    }

    let level = Number(match[1]);
    if (level < 7) {
      let nextLevelURL = 'worlds/challenges_basic/bifrost-' + (level + 1) + '.json?v=1';
      fetch(nextLevelURL)
        .then(function(response) {
          if (!response.ok) {
            throw new Error('Unable to load the next BIFROST level');
          }
          return response.json();
        })
        .then(function(worldJSON) {
          worldJSON.options.jsonFile = nextLevelURL;
          simPanel.loadWorld(JSON.stringify(worldJSON));
        })
        .catch(function(error) {
          showErrorModal(error.message);
        });
      return true;
    }
    return false;
  };

  this.advanceAfterCompletion = function($dialog) {
    if (self.loadNextBifrostLevel()) {
      $dialog.close();
    }
  };

  this.countBlocks = function() {
    let blocks = blockly.workspace.getBlocksByType('when_started')[0].getDescendants();
    let count = blocks.reduce(
      function(s,e) {
        if (e.previousConnection != null || e.nextConnection != null) {
          return s+1
        } else{
          return s
        }
      },
      0
    );

    return count - 1;
  };

  this.handleInteracts = function(interacts) {
    for (let interact of interacts) {
      if (interact.type == 'drop') {
        let triggerBox = babylon.scene.getMeshByID(interact.trigger);
        if (triggerBox.intersectsPoint(robot.body.absolutePosition)) {
          let moveBox = babylon.scene.getMeshByID(interact.move);
          moveBox.physicsImpostor.mass = 1;
        }
      } else if (interact.type == 'move') {
        let triggerBox = babylon.scene.getMeshByID(interact.trigger);
        if (triggerBox.intersectsPoint(robot.body.absolutePosition)) {
          let moveBox = babylon.scene.getMeshByID(interact.move);
          moveBox.position.x += interact.velocity.x;
          moveBox.position.y += interact.velocity.y;
          moveBox.position.z += interact.velocity.z;
        }
      }
    }
  };

  // Logic for intersecting one box
  this.renderIntersectOne = function(delta, meshID, completionCode, interacts=[], blocksLimit=-1) {
    let endBox = babylon.scene.getMeshByID(meshID);

    self.handleInteracts(interacts);

    if (
      skulpt.running == false
      && robot.leftWheel.speed < 1 && robot.rightWheel.speed < 1
    ) {
      if (endBox.intersectsPoint(robot.body.absolutePosition)) {
        let usedBlocks = self.countBlocks();
        if (usedBlocks > blocksLimit && blocksLimit > 0) {
          self.ended = true;
          acknowledgeDialog({
            title: 'Try Again!',
            message: $(
              '<p>You completed the mission, but used too many blocks!</p>' +
              '<p>You used ' + usedBlocks + ' blocks, and will need to reduce it to ' + blocksLimit + ' blocks.</p>'
            )
          });
        } else {
          self.ended = true;
          let time = Math.round((Date.now() - self.challengeStartTime) / 100) / 10;

          self.playVictory();
          let completionDialog = acknowledgeDialog({
            title: 'COMPLETED!',
            message: $(
              '<p>Completion code: ' + completionCode + '</p>' +
              '<p>Time: ' + time + ' seconds</p>'
            )
          });
          setTimeout(function() {
            self.advanceAfterCompletion(completionDialog);
          }, 1000);
        }
      } else {
        self.ended = true;
        acknowledgeDialog({
          title: 'Try Again!',
          message: $(
            '<p>You didn\'t make it this time, but don\'t give up!</p>' +
            '<p>Click the "Reset" button then try again!</p>'
          )
        });
      }
    }
  };

  // Logic for multiple boxes
  this.renderIntersectMulti = function(delta, meshIDs, stopRequired, completionCode, effect='color', interacts=[], blocksLimit=-1) {
    let boxes = [];
    for (let meshID of meshIDs) {
      boxes.push(babylon.scene.getMeshByID(meshID));
    }

    self.handleInteracts(interacts);

    for (let box of boxes) {
      if (
        box
        && box.intersectsPoint(robot.body.absolutePosition)
      ) {
        if (typeof box.challengeState == 'undefined') {
          box.challengeState = 1;
          if (effect == 'color') {
            babylon.setMaterial(box, babylon.getMaterial(babylon.scene, 'ffff0070'));
          }
        } else if (box.challengeState == 1) {
          if (
            (Math.abs(robot.leftWheel.speed) < 1 && Math.abs(robot.rightWheel.speed) < 1)
            || stopRequired == false
          ) {
            box.challengeState = 2;
            if (effect == 'color') {
              babylon.setMaterial(box, babylon.getMaterial(babylon.scene, '00ff0070'));
            } else if (effect == 'hide') {
              box.setEnabled(false);
            }
          }
        }
      }
    }

    let completed = 0;
    for (let box of boxes) {
      if (box && box.challengeState == 2) {
        completed++;
      }
    }
    if (
      skulpt.running == false
      && robot.leftWheel.speed < 1 && robot.rightWheel.speed < 1
    ) {
      if (completed == boxes.length) {
        let usedBlocks = self.countBlocks();
        if (usedBlocks > blocksLimit && blocksLimit > 0) {
          self.ended = true;
          acknowledgeDialog({
            title: 'Try Again!',
            message: $(
              '<p>You completed the mission, but used too many blocks!</p>' +
              '<p>You used ' + usedBlocks + ' blocks, and will need to reduce it to ' + blocksLimit + ' blocks.</p>'
            )
          });
        } else {
          self.ended = true;
          let time = Math.round((Date.now() - self.challengeStartTime) / 100) / 10;

          self.playVictory();
          let completionDialog = acknowledgeDialog({
            title: 'COMPLETED!',
            message: $(
              '<p>Completion code: ' + completionCode + '</p>' +
              '<p>Time: ' + time + ' seconds</p>'
            )
          });
          setTimeout(function() {
            self.advanceAfterCompletion(completionDialog);
          }, 1000);
        }
      } else {
        self.ended = true;
        let remaining = boxes.length - completed;
        acknowledgeDialog({
          title: 'Try Again!',
          message: $(
            '<p>You missed ' + remaining + ' boxes.</p>' +
            '<p>Click the "Reset" button then try again!</p>'
          )
        });
      }
    }
  };

  // Create the scene
  this.load = function (scene) {
    self.ended = false;
    self.started = false;

    let match = false;
    if (self.options.useDefaultRobot) {
      let DEFAULT_ROBOT = {
        'basic': ['twBasic', 'https://files.aposteriori.com.sg/get/ygcmWx4oSE.json'],
      }

      for (let jsonFile in DEFAULT_ROBOT) {
        if (self.options.jsonFile.includes(jsonFile)) {
          if (robot.options.name != DEFAULT_ROBOT[jsonFile][0]) {
            match = true;
            main.loadRobotURL(DEFAULT_ROBOT[jsonFile][1]);
          }
        }
      }
    }

    if (match == false) {
      if (robot.options.name != 'twBasic') {
        main.loadRobotURL('https://files.aposteriori.com.sg/get/ygcmWx4oSE.json');
      }
    }

    if (typeof simPanel != 'undefined') {
      self.panel = simPanel;
    }

    self.panel.showWorldInfoPanel();
    self.drawMissionButton();

    return this.parent.load(scene);
  };

  this.drawMissionButton = function() {
    if (typeof self.panel == 'undefined') {
      return;
    }

    self.panel.clearWorldInfoPanel();
    let $info = $(
      '<div class="mono row">' +
        '<div class="center mission" style="cursor: pointer; user-select: none;">Mission</div>' +
      '</div>'
    );
    $info.find('.mission').click(this.displayMission);
    self.panel.drawWorldInfo($info);
  };
// DISPLAY MISSION CODE
  this.displayMission = function() {
    let $message;

    if (self.options.jsonFile.includes('basic-1.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>'
      );
    } else if (self.options.jsonFile.includes('basic-2.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>Try using multiple "Move Forward" blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('basic-3.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You will need to use a "Turn" block.</p>'
      );
    } else if (self.options.jsonFile.includes('basic-4.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You will need to use a "Turn" block.</p>'
      );
    } else if (self.options.jsonFile.includes('basic-5.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>Sometimes the box is behind you!</p>'
      );
    } else if (self.options.jsonFile.includes('sleep-1.json')) {
      $message = $(
        '<p>Move your robot into every box.</p>' +
        '<p>You will need to stop inside each box for 1 second before moving to the next!</p>'
      );
    } else if (self.options.jsonFile.includes('sleep-2.json')) {
      $message = $(
        '<p>Move your robot into every box.</p>' +
        '<p>You will need to stop inside each box for 1 second before moving to the next!</p>'
      );
    } else if (self.options.jsonFile.includes('maze-1.json')) {
      $message = $(
        '<p>Move your robot into every box.</p>' +
        '<p>You will need to stop inside each box for 1 second before moving to the next!</p>'
      );
    } else if (self.options.jsonFile.includes('maze-2.json')) {
      $message = $(
        '<p>Move your robot into every box.</p>' +
        '<p>You will need to stop inside each box for 1 second before moving to the next!</p>'
      );
    } else if (self.options.jsonFile.includes('maze-3.json')) {
      $message = $(
        '<p>Move your robot into every box.</p>' +
        '<p>You will need to stop inside each box for 1 second before moving to the next!</p>'
      );
    } else if (self.options.jsonFile.includes('maze-4.json')) {
      $message = $(
        '<p>Move your robot into every box.</p>' +
        '<p>You will need to stop inside each box for 1 second before moving to the next!</p>'
      );
    } else if (self.options.jsonFile.includes('maze-5.json')) {
      $message = $(
        '<p>Move your robot into every box.</p>' +
        '<p>You will need to stop inside each box for 1 second before moving to the next!</p>'
      );
    } else if (self.options.jsonFile.includes('maze-6.json')) {
      $message = $(
        '<p>Move your robot into every box.</p>' +
        '<p>You will need to stop inside each box for 1 second before moving to the next!</p>'
      );
    } else if (self.options.jsonFile.includes('dungeon-0.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>'
      );
    } else if (self.options.jsonFile.includes('dungeon-1.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>'
      );
    } else if (self.options.jsonFile.includes('dungeon-2.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>Be careful! The shortest route isn\'t always the best...</p>'
      );
    } else if (self.options.jsonFile.includes('dungeon-3.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>Watch out for the monster!</p>'
      );
    } else if (self.options.jsonFile.includes('dungeon-4.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>How can we get that gate open?</p>'
      );
    } else if (self.options.jsonFile.includes('dungeon-5.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You\'ll need to use everything you\'ve learned!</p>'
      );
    } else if (self.options.jsonFile.includes('dungeon-6.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>Watch out for the ghost!</p>'
      );
    } else if (self.options.jsonFile.includes('loops-0.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You\'re may only use 4 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-0b.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You\'re may only use 4 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-1.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You\'re may only use 5 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-2.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You\'re may only use 6 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-2b.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You\'re may only use 4 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-2c.json')) {
      $message = $(
        '<p>Move your robot into every box and stop for 1 second.</p>' +
        '<p>You\'re may only use 9 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-2d.json')) {
      $message = $(
        '<p>Move your robot into every box and stop for 1 second.</p>' +
        '<p>You\'re may only use 10 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-2e.json')) {
      $message = $(
        '<p>Move your robot into every box and stop for 1 second.</p>' +
        '<p>You\'re may only use 10 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-3.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You may need to use more than one repeat loop.</p>' +
        '<p>You\'re may only use 4 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-3b.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You may need to use more than one repeat loop.</p>' +
        '<p>You\'re may only use 4 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-4.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>Not every block needs to be inside a loop.</p>' +
        '<p>You\'re may only use 6 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-4b.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You\'re may only use 7 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-5.json')) {
      $message = $(
        '<p>Collect all the coins.</p>' +
        '<p>You\'re may only use 4 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-5b.json')) {
      $message = $(
        '<p>Collect all the coins.</p>' +
        '<p>You\'re may only use 7 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-6.json')) {
      $message = $(
        '<p>Collect all the coins.</p>' +
        '<p>You\'re may only use 10 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('loops-7.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>Hint: Look at the example.</p>' +
        '<p>You\'re may only use 8 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('conditions-')) {
      $message = $(
        '<p>Drive into the green box.</p>' +
        '<p>The position of the box changes randomly every time the world is reset.</p>' +
        '<p>Use the color on the ground to figure out where it will appear.</p>'
      );
    } else if (self.options.jsonFile.includes('abstraction-1.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>Don\'t get distracted by the alien!</p>'
      );
    } else if (self.options.jsonFile.includes('abstraction-2.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>Why is there a zebra in the dungeon?</p>'
      );
    } else if (self.options.jsonFile.includes('abstraction-3.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>The cat looks fascinated by the ball!</p>' +
        '<p>You\'re may only use 5 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('abstraction-4.json')) {
      $message = $(
        '<p>Collect all the coins.</p>' +
        '<p>Everything is spinning!</p>' +
        '<p>You\'re may only use 4 blocks.</p>'
      );
    } else if (self.options.jsonFile.includes('abstraction-5.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>Don\'t let the water distract you! The green box changes position on reset.</p>'
      );
    } else if (self.options.jsonFile.includes('abstraction-6.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You\'re may only use 1 block.</p>'
      );
    } else if (self.options.jsonFile.includes('abstraction-7.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You\'re may only use 8 block.</p>'
      );
    } else if (self.options.jsonFile.includes('abstraction-8.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You\'re may only use 11 block.</p>'
      );
    } else if (self.options.jsonFile.includes('abstraction-9.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>You\'re may only use 12 block.</p>'
      );
    } else if (self.options.jsonFile.includes('abstraction-10.json')) {
      $message = $(
        '<p>Collect all the coins.</p>' +
        '<p>You\'re may only use 5 blocks.</p>'      );
    } else if (self.options.jsonFile.includes('abstraction-11.json')) {
      $message = $(
        '<p>Move your robot into the green box and stop inside.</p>' +
        '<p>No blocks limits, but the green box changes position on reset.</p>'
      );
    } else if (self.options.jsonFile.includes('bifrost-1.json')) {
      $message = $('<p>Move forward into the green box and stop inside.</p>');
    } else if (self.options.jsonFile.includes('bifrost-2.json')) {
      $message = $(
        '<p>Move forward into the green box and stop inside.</p>' +
        '<p>Use a repeat loop to avoid repeating the same movement block.</p>'
      );
    } else if (self.options.jsonFile.includes('bifrost-3.json')) {
      $message = $(
        '<p>Reach the green box and stop inside.</p>' +
        '<p>You will need to turn right and move forward.</p>'      );
    } else if (self.options.jsonFile.includes('bifrost-4.json')) {
      $message = $(
        '<p>Reach the green box and stop inside.</p>' +
        '<p>A barrier blocks the direct route, so plan two turns.</p>'      );
    } else if (self.options.jsonFile.includes('bifrost-5.json')) {
      $message = $(
        '<p>Visit every green checkpoint and stop inside each one.</p>' +
        '<p>Use a loop to keep your program short.</p>'      );
    } else if (self.options.jsonFile.includes('bifrost-6.json')) {
      $message = $(
        '<p>Visit all four green checkpoints.</p>' +
        '<p>Use loops and careful turns to reduce the number of blocks used.</p>'
      );
    } else if (self.options.jsonFile.includes('bifrost-7.json')) {
      $message = $(
        '<p>Complete the full five-checkpoint route.</p>' +
        '<p>Use a compact program with loops and careful turns.</p>'      );
    } else if (self.options.jsonFile.includes('bifrost-TEST-1.json')) {
      $message = $(
        '<p> test </p>'
      );
    }
    

    acknowledgeDialog({
      title: 'Mission',
      message: $message
    });
  };

  // Render ADD WORLD HERE
  this.render = function(delta){
    self.parent.render(delta);

    if (self.ended || !self.started) {
      return;
    }

    let elapsedTime = Date.now() - self.challengeStartTime;
    if (elapsedTime < 1000) {
      return;
    }
    if (self.options.jsonFile.includes('bifrost-1.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'BIFROST-1');
    } else if (self.options.jsonFile.includes('bifrost-2.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'BIFROST-2', [], 5);
    } else if (self.options.jsonFile.includes('bifrost-3.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'BIFROST-3', [], 6);
    } else if (self.options.jsonFile.includes('bifrost-4.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'BIFROST-4', [], 7);
    } else if (self.options.jsonFile.includes('bifrost-5.json')) {
      self.renderIntersectMulti(delta, ['worldBaseObject_box0', 'worldBaseObject_box1', 'worldBaseObject_box2'], true, 'BIFROST-5', 'color', [], 6);
    } else if (self.options.jsonFile.includes('bifrost-6.json')) {
      self.renderIntersectMulti(delta, ['worldBaseObject_box0', 'worldBaseObject_box1', 'worldBaseObject_box2', 'worldBaseObject_box3'], true, 'BIFROST-6', 'color', [], 8);
    } else if (self.options.jsonFile.includes('bifrost-7.json')) {
      self.renderIntersectMulti(delta, ['worldBaseObject_box0', 'worldBaseObject_box1', 'worldBaseObject_box2', 'worldBaseObject_box3', 'worldBaseObject_box4'], true, 'BIFROST-7', 'color', [], 10);
    } else if (self.options.jsonFile.includes('bifrost-TEST-1')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'BIFROST');
    } else if (self.options.jsonFile.includes('basic-1.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'UNICORN');
    } else if (self.options.jsonFile.includes('basic-2.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'ELEPHANT');
    } else if (self.options.jsonFile.includes('basic-3.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'DOG');
    } else if (self.options.jsonFile.includes('basic-4.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'CAT');
    } else if (self.options.jsonFile.includes('basic-5.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'MOUSE');
    } else if (self.options.jsonFile.includes('sleep-1.json')) {
      self.renderIntersectMulti(delta, ['worldBaseObject_box0', 'worldBaseObject_box1', 'worldBaseObject_box2', 'worldBaseObject_box3'], true, 'SLOTH');
    } else if (self.options.jsonFile.includes('sleep-2.json')) {
      self.renderIntersectMulti(delta, ['worldBaseObject_box0', 'worldBaseObject_box1', 'worldBaseObject_box2', 'worldBaseObject_box3'], true, 'PANDA');
    } else if (self.options.jsonFile.includes('maze-1.json')) {
      self.renderIntersectMulti(delta, ['worldBaseObject_box1', 'worldBaseObject_box2'], true, 'MOLE');
    } else if (self.options.jsonFile.includes('maze-2.json')) {
      self.renderIntersectMulti(delta, ['worldBaseObject_box1', 'worldBaseObject_box2'], true, 'HEDGEHOG');
    } else if (self.options.jsonFile.includes('maze-3.json')) {
      self.renderIntersectMulti(delta, ['worldBaseObject_box3', 'worldBaseObject_box4', 'worldBaseObject_box5'], true, 'RABBIT');
    } else if (self.options.jsonFile.includes('maze-4.json')) {
      self.renderIntersectMulti(delta, ['worldBaseObject_box3', 'worldBaseObject_box4', 'worldBaseObject_box5'], true, 'DONKEY');
    } else if (self.options.jsonFile.includes('maze-5.json')) {
      self.renderIntersectMulti(delta, ['worldBaseObject_box3', 'worldBaseObject_box4', 'worldBaseObject_box5'], true, 'TURKEY');
    } else if (self.options.jsonFile.includes('maze-6.json')) {
      self.renderIntersectMulti(delta, ['worldBaseObject_box3', 'worldBaseObject_box4', 'worldBaseObject_box5'], true, 'FOX');
    } else if (self.options.jsonFile.includes('dungeon-0.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box5', 'IMP');
    } else if (self.options.jsonFile.includes('dungeon-1.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box5', 'ORC');
    } else if (self.options.jsonFile.includes('dungeon-2.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box5', 'TROLL',
        [
          {
            type: 'drop',
            trigger: 'worldBaseObject_box11',
            move: 'worldBaseObject_box2'
          }
        ]
      );
    } else if (self.options.jsonFile.includes('dungeon-3.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box2', 'MINOTAUR');
    } else if (self.options.jsonFile.includes('dungeon-4.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box1', 'CYCLOP',
        [
          {
            type: 'move',
            trigger: 'worldBaseObject_cylinder11',
            move: 'worldBaseObject_model10',
            velocity: {
              x: 0,
              y: -0.1,
              z: 0
            },
          }
        ]
      );
    } else if (self.options.jsonFile.includes('dungeon-5.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box1', 'DRAGON',
        [
          {
            type: 'drop',
            trigger: 'worldBaseObject_box19',
            move: 'worldBaseObject_box0'
          },
          {
            type: 'move',
            trigger: 'worldBaseObject_cylinder11',
            move: 'worldBaseObject_model10',
            velocity: {
              x: 0,
              y: 0,
              z: -0.1
            },
          }
        ]
      );
    } else if (self.options.jsonFile.includes('dungeon-6.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box1', 'MANTICORE',
        [
          {
            type: 'drop',
            trigger: 'worldBaseObject_box16',
            move: 'worldBaseObject_box0'
          },
          {
            type: 'drop',
            trigger: 'worldBaseObject_box19',
            move: 'worldBaseObject_box18'
          },
          {
            type: 'drop',
            trigger: 'worldBaseObject_box32',
            move: 'worldBaseObject_box31'
          },
          {
            type: 'move',
            trigger: 'worldBaseObject_cylinder11',
            move: 'worldBaseObject_model10',
            velocity: {
              x: 0,
              y: 0,
              z: -0.1
            },
          }
        ]
      );
    } else if (self.options.jsonFile.includes('loops-0.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box5', 'PLUTO', [], 4);
    } else if (self.options.jsonFile.includes('loops-0b.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box5', 'CHARON', [], 4);
    } else if (self.options.jsonFile.includes('loops-1.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box5', 'NEPTUNE', [], 5);
    } else if (self.options.jsonFile.includes('loops-2.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'URANUS', [], 6);
    } else if (self.options.jsonFile.includes('loops-2b.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box5', 'TITANIA', [], 4);
    } else if (self.options.jsonFile.includes('loops-2c.json')) {
      self.renderIntersectMulti(delta, ['worldBaseObject_box5', 'worldBaseObject_box11'], true, 'OBERON', 'color', [], 9);
    } else if (self.options.jsonFile.includes('loops-2d.json')) {
      self.renderIntersectMulti(delta, ['worldBaseObject_box5', 'worldBaseObject_box16'], true, 'MIRANDA', 'color', [], 10);
    } else if (self.options.jsonFile.includes('loops-2e.json')) {
      self.renderIntersectMulti(delta, ['worldBaseObject_box5', 'worldBaseObject_box8'], true, 'CRISSIDA', 'color', [], 10);
    } else if (self.options.jsonFile.includes('loops-3.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'SATURN', [], 4);
    } else if (self.options.jsonFile.includes('loops-3b.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'TITAN', [], 4);
    } else if (self.options.jsonFile.includes('loops-4.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'JUPITER', [], 6);
    } else if (self.options.jsonFile.includes('loops-4b.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'EUROPA', [], 7);
    } else if (self.options.jsonFile.includes('loops-5.json')) {
      self.renderIntersectMulti(
        delta,
        ['worldBaseObject_model7', 'worldBaseObject_model8', 'worldBaseObject_model9'],
        false,
        'MARS',
        'hide',
        [],
        7
      );
    } else if (self.options.jsonFile.includes('loops-5b.json')) {
      self.renderIntersectMulti(
        delta,
        ['worldBaseObject_model14', 'worldBaseObject_model15', 'worldBaseObject_model16', 'worldBaseObject_model17', 'worldBaseObject_model18', 'worldBaseObject_model19'],
        false,
        'PHOBOS',
        'hide',
        [],
        7
      );
    } else if (self.options.jsonFile.includes('loops-6.json')) {
      self.renderIntersectMulti(
        delta,
        ['worldBaseObject_model13', 'worldBaseObject_model14', 'worldBaseObject_model15'],
        false,
        'EARTH',
        'hide',
        [],
        10
      );
    } else if (self.options.jsonFile.includes('loops-7.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'MOON', [], 8);
    } else if (self.options.jsonFile.includes('conditions-1.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'STONE');
    } else if (self.options.jsonFile.includes('conditions-2.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'SECRETS');
    } else if (self.options.jsonFile.includes('conditions-3.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'AZKABAN');
    } else if (self.options.jsonFile.includes('conditions-4.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'FIRE');
    } else if (self.options.jsonFile.includes('conditions-5.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'PHOENIX');
    } else if (self.options.jsonFile.includes('conditions-6.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'PRINCE');
    } else if (self.options.jsonFile.includes('conditions-7.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'CHOCOLATE');
    } else if (self.options.jsonFile.includes('conditions-8.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'BANANA');
    } else if (self.options.jsonFile.includes('conditions-8b.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'SALTED CARAMEL');
    } else if (self.options.jsonFile.includes('conditions-9.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'AVOCADO');
    } else if (self.options.jsonFile.includes('conditions-9b.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'BLUEBERRY');
    } else if (self.options.jsonFile.includes('conditions-10.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'VANILLA');
    } else if (self.options.jsonFile.includes('conditions-11.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'CARAMEL');
    } else if (self.options.jsonFile.includes('conditions-12.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'OREO');
    } else if (self.options.jsonFile.includes('abstraction-1.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box1', 'TABBY',
        [
          {
            type: 'drop',
            trigger: 'worldBaseObject_box19',
            move: 'worldBaseObject_box0'
          },
        ]
      );
    } else if (self.options.jsonFile.includes('abstraction-2.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box1', 'CALICO',
        [
          {
            type: 'drop',
            trigger: 'worldBaseObject_box19',
            move: 'worldBaseObject_box0'
          },
        ]
      );
    } else if (self.options.jsonFile.includes('abstraction-3.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box1', 'GINGER',
        [
          {
            type: 'drop',
            trigger: 'worldBaseObject_box18',
            move: 'worldBaseObject_box0'
          },
          {
            type: 'move',
            trigger: 'worldBaseObject_cylinder11',
            move: 'worldBaseObject_box13',
            velocity: {
              x: 0,
              y: 0,
              z: -0.1
            },
          }
        ],
        5
      );
    } else if (self.options.jsonFile.includes('abstraction-4.json')) {
      self.renderIntersectMulti(
        delta,
        ['worldBaseObject_model28', 'worldBaseObject_model29', 'worldBaseObject_model30'],
        false,
        'SIAMESE',
        'hide',
        [
          {
            type: 'drop',
            trigger: 'worldBaseObject_box16',
            move: 'worldBaseObject_box0'
          },
          {
            type: 'move',
            trigger: 'worldBaseObject_cylinder9',
            move: 'worldBaseObject_box11',
            velocity: {
              x: 0,
              y: 0,
              z: -0.1
            },
          }
        ],
        4
      );
    } else if (self.options.jsonFile.includes('abstraction-5.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box1', 'RAGDOLL',
        [
          {
            type: 'drop',
            trigger: 'worldBaseObject_box18',
            move: 'worldBaseObject_box0'
          },
          {
            type: 'move',
            trigger: 'worldBaseObject_cylinder11',
            move: 'worldBaseObject_box13',
            velocity: {
              x: 0,
              y: 0,
              z: -0.1
            },
          }
        ]
      );
    } else if (self.options.jsonFile.includes('abstraction-6.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'Indri', [], 1);
    } else if (self.options.jsonFile.includes('abstraction-7.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box1', 'Fossa', [
        {
          type: 'drop',
          trigger: 'worldBaseObject_box9',
          move: 'worldBaseObject_box0'
        }
      ], 8);
    } else if (self.options.jsonFile.includes('abstraction-8.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box1', 'Dingo', [
        {
          type: 'drop',
          trigger: 'worldBaseObject_box19',
          move: 'worldBaseObject_box0'
        }
      ], 11);
    } else if (self.options.jsonFile.includes('abstraction-9.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box1', 'Aardvark', [
        {
          type: 'drop',
          trigger: 'worldBaseObject_box12',
          move: 'worldBaseObject_box0'
        }
      ], 12);
    } else if (self.options.jsonFile.includes('abstraction-10.json')) {
      self.renderIntersectMulti(
        delta,
        ['worldBaseObject_model158', 'worldBaseObject_model159', 'worldBaseObject_model160'],
        false,
        'Zapus',
        'hide',
        [
          {
            type: 'drop',
            trigger: 'worldBaseObject_box11',
            move: 'worldBaseObject_box0'
          }
        ],
        5
      );
    } else if (self.options.jsonFile.includes('abstraction-11.json')) {
      self.renderIntersectOne(delta, 'worldBaseObject_box0', 'Xerus');
    }
  };

  // startSim
  this.startSim = function() {
    if (self.started) {
      self.ended = true;
    }
    self.started = true;
    self.parent.startSim();

    self.challengeStartTime = Date.now();
  };

  // detect if robot is manually moved
  this.manualMoved = function() {
    self.ended = true;
  };

  // stopSim
  this.stopSim = function() {
    self.ended = true;
    acknowledgeDialog({
      title: 'Oops!',
      message: $(
        '<p>You cannot stop and restart.</p>' +
        '<p>Click the "Reset" button then try again!</p>' +
        '<p>Make sure to click the "Run" button once and wait for it to complete.</p>'
      )
    });
  };

}

// Init class
challenges_basic.init();

if (typeof worlds == 'undefined') {
  var worlds = [];
}
worlds.push(challenges_basic);
