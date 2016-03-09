function Profile(character) {
    var self = this;

    this.id = character.characterBase.characterId;
    this.order = ko.observable(character.index);
    this.icon = ko.observable("");
    this.gender = ko.observable("");
    this.classType = ko.observable("");
    this.level = ko.observable("");
    this.stats = ko.observable("");
    this.race = ko.observable("");
    this.percentToNextLevel = ko.observable("");
    this.background = ko.observable("");
    this.items = ko.observableArray().extend({
        rateLimit: {
            timeout: 500,
            method: "notifyWhenChangesStop"
        }
    });
    this.items.subscribe(app.redraw);
    this.reloadingBucket = false;
    this.statsShowing = ko.observable(false);
    this.weapons = ko.pureComputed(this._weapons, this);
    this.armor = ko.pureComputed(this._armor, this);
    this.general = ko.pureComputed(this._general, this);
    this.invisible = ko.pureComputed(this._invisible, this);
    this.lostItems = ko.pureComputed(this._lostItems, this);
    this.equippedGear = ko.pureComputed(this._equippedGear, this);
    this.equippedStats = ko.pureComputed(this._equippedStats, this);
    this.sumCSP = ko.pureComputed(this._sumCSP, this);
    this.equippedSP = ko.pureComputed(this._equippedSP, this);
    this.equippedTier = ko.pureComputed(this._equippedTier, this);
    this.tierCSP = ko.pureComputed(this._tierCSP, this);
    this.potentialCSP = ko.pureComputed(this._potentialCSP, this);
    this.powerLevel = ko.pureComputed(this._powerLevel, this);
    this.classLetter = ko.pureComputed(this._classLetter, this);
    this.uniqueName = ko.pureComputed(this._uniqueName, this);
    this.iconBG = ko.pureComputed(this._iconBG, this);
    this.container = ko.observable();
    this.reloadBucket = _.bind(this._reloadBucket, this);
    this.init(character);

    this.weapons.subscribe(app.addWeaponTypes);
    this.items.subscribe(app.addTierTypes);
}

Profile.prototype = {
    init: function(profile) {
        var self = this;

        if (self.id == "Vault") {
            self.background(app.makeBackgroundUrl("assets/vault_emblem.jpg", true));
            self.icon("assets/vault_icon.jpg");
            self.gender("Tower");
            self.classType("Vault");
        } else {
            self.updateCharacter(profile);
        }
        var processedItems = [];
        _.each(profile.items, function(item) {
            var processedItem = new Item(item, self);
            if ("id" in processedItem) processedItems.push(processedItem);
        });

        self.items(processedItems);
        if (self.id != "Vault" && typeof profile.processed == "undefined") {
            self._reloadBucket(self, undefined, _.noop, true);
        }
    },
    setFarmTarget: function() {
        app.farmTarget(this.id);
    },
    updateCharacter: function(profile) {
        var self = this;
        if (profile && profile.processed) {
            self.background(profile.characterBase.background);
            self.icon(profile.characterBase.icon);
            self.gender(profile.characterBase.gender);
            self.classType(profile.characterBase.classType);
            self.level(profile.characterBase.level);
            self.stats(profile.characterBase.stats);
            self.race(profile.characterBase.race);
            self.percentToNextLevel(0);
        } else {
            self.background(app.makeBackgroundUrl(tgd.dataDir + profile.backgroundPath, true));
            self.icon(tgd.dataDir + profile.emblemPath);
            self.gender(tgd.DestinyGender[profile.characterBase.genderType]);
            self.classType(tgd.DestinyClass[profile.characterBase.classType]);
            self.level(profile.characterLevel);
            self.stats(profile.characterBase.stats);
            if (!("STAT_LIGHT" in self.stats()))
                self.stats()['STAT_LIGHT'] = 0;
            self.percentToNextLevel(profile.percentToNextLevel);
            self.race(_raceDefs[profile.characterBase.raceHash].raceName);
        }
    },
    refresh: function(profile, event) {
        tgd.localLog("refresh event called");
        var self = this;
        if (self.id == "Vault") {
            self._reloadBucket(self, event);
        } else {
            app.bungie.character(self.id, function(result) {
                if (result && result.data) {
                    self.updateCharacter(result.data);
                    self._reloadBucket(self, event);
                }
            });
        }
    },
    getBucketTypeHelper: function(item, info) {
        var self = this;
        if (typeof info == "undefined") {
            return "";
        } else if (item.location !== 4) {
            return tgd.DestinyBucketTypes[info.bucketTypeHash];
        } else if (item.isEquipment || tgd.lostItemsHelper.indexOf(item.itemHash) > -1 || (item.location == 4 && item.itemInstanceId > 0)) {
            return "Lost Items";
        } else if (tgd.invisibleItemsHelper.indexOf(item.itemHash) > -1) {
            return "Invisible";
        }
        return "Messages";
    },
    reloadBucketFilter: function(buckets) {
        var self = this;
        return function(item) {
            var info = {};
            if (item.itemHash in _itemDefs) {
                info = _itemDefs[item.itemHash];
            } else {
                /* Classified Items */
                info = {
                    bucketTypeHash: "1498876634",
                    itemName: "Classified",
                    tierTypeName: "Exotic",
                    icon: "/img/misc/missing_icon.png",
                    itemTypeName: "Classified"
                };
            }
            if (info && info.bucketTypeHash) {
                if (info.bucketTypeHash in tgd.DestinyBucketTypes) {
                    var itemBucketType = self.getBucketTypeHelper(item, info);
                    if (buckets.indexOf(itemBucketType) > -1) {
                        return true;
                    }
                }
                /*else {
					console.log( unescape(info.itemName) + " " + info.bucketTypeHash );
				}*/
            }
        };
    },
    reloadBucketHandler: function(buckets, done) {
        var self = this;
        return function(results, response) {
            if (results && results.data && results.data.buckets) {
                var items = _.filter(app.bungie.flattenItemArray(results.data.buckets), self.reloadBucketFilter(buckets));
                _.each(items, function(item) {
                    var processedItem = new Item(item, self);
                    if ("id" in processedItem) self.items.push(processedItem);
                });
                done();
            } else {
                if (results && results.ErrorCode && results.ErrorCode == 99) {
                    done();
                    return BootstrapDialog.alert(results.Message);
                } else {
                    done();
                    app.refresh();
                    return BootstrapDialog.alert("Code 20: " + app.activeText().error_loading_inventory + JSON.stringify(response));
                }
            }
        };
    },
    calculatePowerLevelWithItems: function(items) {
        if (items.length === 0) {
            return 0;
        }
        var index = items.filter(this.filterItemByType("Artifact", true)).length;
        var weights = tgd.DestinyBucketWeights[index];
        if (weights) {
            var eligibleGear = _.filter(items, function(item) {
                return item.bucketType in weights;
            });
            var primaryStatsGear = _.map(eligibleGear, function(item) {
                return item.primaryStatValue() * (weights[item.bucketType] / 100);
            });
            var powerLevel = Math.floor(tgd.sum(primaryStatsGear));
            return powerLevel;
        } else {
            return 0;
        }
    },
    _equippedGear: function() {
        return _.filter(this.items(), function(item) {
            return item.isEquipped();
        });
    },
    _equippedStats: function() {
        return tgd.joinStats(this.equippedGear());
    },
    _equippedSP: function() {
        return _.filter(this.equippedStats(), function(value, stat) {
            return _.where(tgd.DestinyArmorStats, {
                statName: stat
            }).length > 0;
        });
    },
    _sumCSP: function() {
        return tgd.sum(this.equippedSP());
    },
    _equippedTier: function() {
        var theoreticalTier = Math.floor(this.sumCSP() / tgd.DestinySkillTier);
        var effectiveTier = tgd.sum(_.map(this.equippedSP(), function(value) {
            return Math.floor(value / tgd.DestinySkillTier);
        }));
        return effectiveTier + "/" + theoreticalTier;
    },
    _tierCSP: function() {
        return this.equippedTier().split("/")[1] * tgd.DestinySkillTier;
    },
    _potentialCSP: function() {
        return tgd.sum(_.map(_.filter(this.equippedGear(), function(item) {
            return item.armorIndex > -1;
        }), function(item) {
            return Math.floor(tgd.calculateStatRoll(item, tgd.DestinyLightCap, true));
        }));
    },
    _classLetter: function() {
        return this.classType()[0].toUpperCase();
    },
    _uniqueName: function() {
        return this.level() + " " + this.race() + " " + this.gender() + " " + this.classType();
    },
    _iconBG: function() {
        return app.makeBackgroundUrl(this.icon(), true);
    },
    _powerLevel: function() {
        if (this.id == "Vault") return "";
        return this.calculatePowerLevelWithItems(this.equippedGear());
    },
    _reloadBucket: function(model, event, callback, excludeMessage) {
        var self = this,
            element;
        if (self.reloadingBucket) {
            return;
        }

        if (!excludeMessage)
            $.toaster({
                priority: 'info',
                title: 'Success',
                message: 'Refreshing ' + self.uniqueName(),
                settings: {
                    timeout: tgd.defaults.toastTimeout
                }
            });

        var buckets = [];
        if (typeof model === 'string' || model instanceof String) {
            buckets.push(model);
        } else if (model instanceof tgd.Layout) {
            buckets.push.apply(buckets, model.bucketTypes);
        } else if (model instanceof Profile) {
            //TODO Investigate the implications of not using the extras property of layout to fix Ghost/Artifacts
            _.each(tgd.DestinyLayout, function(layout) {
                buckets.push.apply(buckets, layout.bucketTypes);
            });
            buckets.splice(buckets.indexOf("Invisible"), 1);
        }

        self.reloadingBucket = true;
        if (typeof event !== "undefined") {
            element = $(event.target).is(".fa") ? $(event.target) : $(event.target).find(".fa");
            if (element.is(".fa") === false) {
                element = $(event.target).is(".emblem") ? $(event.target) : $(event.target).find(".emblem");
                if (element.is(".emblem") === false) {
                    element = $(event.target).parent().find(".emblem");
                }
            }
            element.addClass("fa-spin");
        }

        var needsInvisibleRefresh = buckets.indexOf("Invisible") > -1;

        function done() {
            function reallyDone() {
                self.reloadingBucket = false;
                if (element) {
                    element.removeClass("fa-spin");
                }
                if (!excludeMessage)
                    $.toaster({
                        priority: 'info',
                        title: 'Success',
                        message: 'Refresh completed for ' + self.uniqueName(),
                        settings: {
                            timeout: tgd.defaults.toastTimeout
                        }
                    });
            }

            if (needsInvisibleRefresh) {
                app.bungie.account(function(results, response) {
                    if (results && results.data && results.data.inventory && results.data.inventory.buckets && results.data.inventory.buckets.Invisible) {
                        var invisible = results.data.inventory.buckets.Invisible;
                        invisible.forEach(function(b) {
                            b.items.forEach(function(item) {
                                self.items.push(new Item(item, self, true));
                            });
                        });
                        reallyDone();
                    } else {
                        reallyDone();
                        app.refresh();
                        return BootstrapDialog.alert("Code 40: " + app.activeText().error_loading_inventory + JSON.stringify(response));
                    }
                });
            } else {
                reallyDone();
            }
            if (callback)
                callback();
        }

        var itemsToRemove = _.filter(self.items(), function(item) {
            return buckets.indexOf(item.bucketType) > -1;
        });
        self.items.removeAll(itemsToRemove);

        if (self.id == "Vault") {
            app.bungie.vault(self.reloadBucketHandler(buckets, done));
        } else {
            app.bungie.inventory(self.id, self.reloadBucketHandler(buckets, done));
        }
    },
    _weapons: function() {
        return _.filter(this.items(), function(item) {
            if (item.weaponIndex > -1)
                return item;
        });
    },
    _armor: function() {
        return _.filter(this.items(), function(item) {
            if (item.armorIndex > -1 && tgd.DestinyGeneralExceptions.indexOf(item.bucketType) == -1)
                return item;
        });
    },
    _general: function() {
        return _.filter(this.items(), function(item) {
            if ((item.armorIndex == -1 || tgd.DestinyGeneralExceptions.indexOf(item.bucketType) > -1) && item.weaponIndex == -1 && item.bucketType !== "Post Master" && item.bucketType !== "Messages" && item.bucketType !== "Invisible" && item.bucketType !== "Lost Items" && item.bucketType !== "Subclasses")
                return item;
        });
    },
    _invisible: function() {
        return _.filter(this.items(), function(item) {
            if (item.bucketType == "Invisible")
                return item;
        });
    },
    _lostItems: function() {
        return _.filter(this.items(), function(item) {
            if (item.bucketType == "Lost Items")
                return item;
        });
    },
    filterItemByType: function(type, isEquipped) {
        return function(item) {
            return (item.bucketType == type && item.isEquipped() == isEquipped);
        };
    },
    all: function(type) {
        var items = _.where(this.items(), {
            bucketType: type
        });
        var activeSort = parseInt(app.activeSort());
        /* Tier, Type */
        if (activeSort === 0) {
            items = _.sortBy(items, function(item) {
                return [item.tierType * -1, item.type];
            }).reverse();
        }
        /* Type */
        else if (activeSort === 1) {
            items = _.sortBy(items, function(item) {
                return item.type;
            });
        }
        /* Light */
        else if (activeSort === 2) {
            items = _.sortBy(items, function(item) {
                return item.primaryStatValue() * -1;
            });
        }
        /* Damage */
        else if (activeSort === 3) {
            items = _.sortBy(items, function(item) {
                return item.damageType;
            });
        }
        /* Name */
        else if (activeSort === 4) {
            items = _.sortBy(items, function(item) {
                return item.description;
            });
        }
        /* Tier, Light */
        else if (activeSort === 5) {
            items = _.sortBy(items, function(item) {
                return [item.tierType * -1, item.primaryStatValue() * -1];
            }).reverse();
        }
        /* Tier, Name */
        else if (activeSort === 6) {
            items = _.sortBy(items, function(item) {
                return [item.tierType * -1, item.description * -1];
            }).reverse();
        }
        return items;
    },
    get: function(type) {
        return this.all(type).filter(this.filterItemByType(type, false));
    },
    getVisible: function(type) {
        return _.filter(this.get(type), function(item) {
            return item.isVisible();
        });
    },
    itemEquipped: function(type) {
        return ko.utils.arrayFirst(this.items(), this.filterItemByType(type, true));
    },
    itemEquippedVisible: function(type) {
        var ie = this.itemEquipped(type);
        return _.isEmpty(ie) ? false : ie.isVisible();
    },
    toggleStats: function() {
        this.statsShowing(!this.statsShowing());
    },
    queryRolls: function(items, callback) {
        var count = 0;

        function done() {
            count++;
            if (items.length == count) {
                callback();
            }
        }

        function getRolls(item, callback) {
            app.bungie.getItemDetail(item.characterId(), item._id, function(detail) {
                var emptyRolls = [{
                    calculated: {},
                    base: {}
                }, {
                    calculated: {},
                    base: {}
                }];
                item.rolls = _.reduce(detail.data.statsOnNodes, function(rolls, stat, key, stats) {
                    var index = _.keys(stats).indexOf(key);
                    _.each(stat.currentNodeStats, function(node) {
                        _.each(rolls, function(roll, rollIndex) {
                            var key = _statDefs[node.statHash].statName;
                            if (index === 0 || (index > 0 && rollIndex === 0)) {
                                roll.calculated[key] = (roll.calculated[key] || 0) + node.value;
								if ( index === 0 ){
									roll.base[key] = (roll.base[key] || 0) + node.value;
								}
                            }
                        });
                    });
                    _.each(stat.nextNodeStats, function(node) {
                        _.each(rolls, function(roll, rollIndex) {
                            var key = _statDefs[node.statHash].statName;
                            if (rollIndex === 1) {
                                roll.calculated[key] = (roll.calculated[key] || 0) + node.value;
                            }
                        });
                    });
                    return rolls;
                }, emptyRolls);
                window.localStorage.setItem("statrolls_" + item._id, JSON.stringify(item.rolls));
                callback();
            });
        }
        _.each(items, function(item) {
            if (!item.rolls) {
                var cachedRolls = window.localStorage.getItem("statrolls_" + item._id);
                if (cachedRolls) {
                    item.rolls = JSON.parse(cachedRolls);
                    if (tgd.sum(item.rolls[0].calculated) != tgd.sum(item.stats)) {
                        getRolls(item, done);
                    } else {
                        done();
                    }
                } else {
                    getRolls(item, done);
                }
            } else {
                done();
            }
        });
    },
    reduceMaxSkill: function(type, buckets, items) {
        var character = this;
        tgd.localLog("highest set is above max cap");
        var fullSets = [];
        var alternatives = [];
        _.each(buckets, function(bucket) {
            candidates = _.filter(items, function(item) {
                return _.isObject(item.stats) && item.bucketType == bucket && item.equipRequiredLevel <= character.level() && item.canEquip === true && (
                    (item.classType != 3 && tgd.DestinyClass[item.classType] == character.classType()) || (item.classType === 3 && item.armorIndex > -1 && item.typeName.indexOf(character.classType()) > -1) || (item.weaponIndex > -1) || item.bucketType == "Ghost"
                );
            });
            tgd.localLog("candidates considering " + candidates.length);
            _.each(candidates, function(candidate) {
                if (candidate.stats[type] > 0) {
                    //tgd.localLog(candidate);
                    fullSets.push([candidate]);
                } else {
                    alternatives.push([candidate]);
                }
            });
        });
        tgd.localLog("full sets considering " + fullSets.length);
        //tgd.localLog( fullSets );
        var statAlternatives = _.flatten(fullSets);
        tgd.localLog("full sets considering " + fullSets.length);
        _.each(fullSets, function(set) {
            var mainItem = set[0];
            var currentStat = mainItem.stats[type];
            tgd.localLog(currentStat + " for main item: " + mainItem.description);
            _.each(buckets, function(bucket) {
                if (bucket != mainItem.bucketType) {
                    if (currentStat < tgd.DestinySkillCap) {
                        candidates = _.filter(statAlternatives, function(item) {
                            return item.bucketType == bucket &&
                                ((item.tierType != 6 && mainItem.tierType == 6) || (mainItem.tierType != 6));
                        });
                        if (candidates.length > 0) {
                            primaryStats = _.map(candidates, function(item) {
                                return item.stats[type];
                            });
                            tgd.localLog(bucket + " choices are " + primaryStats);
                            var maxCandidateValue = _.max(primaryStats);
                            maxCandidate = candidates[primaryStats.indexOf(maxCandidateValue)];
                            var deltas = {};
                            _.each(candidates, function(candidate, index) {
                                tgd.localLog(candidate.description + " considering candidate currentStat " + candidate.stats[type]);
                                var delta = ((currentStat + candidate.stats[type]) - tgd.DestinySkillCap);
                                if (delta >= 0) {
                                    var allStatsSummed = ((currentStat + candidate.getValue("All")) - candidate.stats[type] - tgd.DestinySkillCap);
                                    if (allStatsSummed >= 0) {
                                        deltas[index] = allStatsSummed;
                                    }
                                }
                                //tgd.localLog("new currentStat is " + currentStat);

                            });
                            var values = _.values(deltas),
                                keys = _.keys(deltas);
                            if (values.length > 0) {
                                maxCandidate = candidates[keys[values.indexOf(_.min(values))]];
                                tgd.localLog(" new max candidate is " + maxCandidate.description);
                            }
                            currentStat += maxCandidate.stats[type];
                            tgd.localLog("new currentStat is " + currentStat);
                            set.push(maxCandidate);
                        }
                    } else {
                        tgd.localLog("adding alternative, maxCap is full on this set");
                        candidates = _.filter(alternatives, function(item) {
                            return item.bucketType == bucket;
                        });
                        if (candidates.length > 0) {
                            primaryStats = _.map(candidates, function(item) {
                                return item.getValue("All");
                            });
                            set.push(candidates[primaryStats.indexOf(_.max(primaryStats))]);
                        }
                    }
                }
            });
        });
        var availableSets = [];
        _.map(fullSets, function(set) {
            var sumSet = tgd.joinStats(set);
            if (sumSet[type] >= tgd.DestinySkillCap) {
                availableSets.push({
                    set: set,
                    sumSet: sumSet
                });
                tgd.localLog(sumSet);
            }
        });
        var sumSetValues = _.sortBy(_.map(availableSets, function(combo) {
            var score = tgd.sum(_.map(combo.sumSet, function(value, key) {
                var result = Math.floor(value / tgd.DestinySkillTier);
                return result > 5 ? 5 : result;
            }));
            combo.sum = tgd.sum(_.values(combo.sumSet));
            var subScore = (combo.sum / 1000);
            combo.score = score + subScore;
            return combo;
        }), 'score');
        var highestSetObj = sumSetValues[sumSetValues.length - 1];
        return [highestSetObj.sum, highestSetObj.set];
    },
    findBestArmorSetV2: function(items, callback) {
        var buckets = [].concat(tgd.DestinyArmorPieces),
            sets = [],
            bestSets = [],
            backups = [],
            groups = {},
            candidates,
            statGroups = {},
            highestArmorTier = 0,
            highestArmorValue = 0,
            highestTierValue = 0,
            character = this;


        _.each(buckets, function(bucket) {
            groups[bucket] = _.filter(items, function(item) {
                return item.bucketType == bucket && item.equipRequiredLevel <= character.level() && item.canEquip === true && (
                    (item.classType != 3 && tgd.DestinyClass[item.classType] == character.classType()) || (item.classType == 3 && item.armorIndex > -1 && item.typeName.indexOf(character.classType()) > -1) || (item.weaponIndex > -1) || item.bucketType == "Ghost"
                );
            });
            var csps = _.map(groups[bucket], function(item) {
                return tgd.calculateStatRoll(item, tgd.DestinyLightCap, true);
            });
            statGroups[bucket] = {
                max: _.max(csps),
                min: _.min(csps)
            };
        });

        highestArmorValue = tgd.sum(_.map(statGroups, function(stat) {
            return stat.max;
        }));
		console.log(_.object(_.map(statGroups, function(stat, key) { return [key, stat.max]; })));
        console.log("highestArmorValue:"+highestArmorValue);

        highestArmorTier = Math.floor(highestArmorValue / tgd.DestinySkillTier);
        console.log("highestArmorTier :"+highestArmorTier );

        highestTierValue = highestArmorTier * tgd.DestinySkillTier;
        console.log("highestTierValue :"+highestTierValue );
		
        _.each(groups, function(items, bucketType) {
            var minCSP = highestTierValue - (highestArmorValue - statGroups[bucketType].max);
            console.log(bucketType+":"+minCSP +",before:" + items.length);
            candidates = _.filter(items, function(item) {
				if ( bucketType == "Helmet") {
					console.log(item.description, item, item.getValue("MaxLight"), minCSP);
				}
                return item.getValue("MaxLight") >= minCSP;
            });
            console.log("after:" + candidates.length);
			if ( bucketType == "Helmet") {
				console.log(candidates);
			}
            _.each(candidates, function(candidate) {
                sets.push([candidate]);
            });
        });
		
        backups = _.flatten(sets);

        character.queryRolls(backups, function() {
            _.each(sets, function(set) {
                var mainPiece = set[0], mainPieceMaxLight = mainPiece.getValue("MaxLight");
				console.log("mainPiece", mainPiece.description, mainPieceMaxLight);
                //instead of looping over each mainPiece it'll be the mainPiece.rolls array which will contain every combination
                var arrRolls = _.map(mainPiece.rolls, function(roll) {
                    var mainClone = _.clone(mainPiece, true);
                    var subSets = [
                        [mainClone]
                    ];
                    mainClone.activeRoll = roll;
                    mainClone.isActiveRoll = _.reduce(mainClone.stats, function(isActiveRoll, value, key) {
                        return isActiveRoll === true && (mainClone.activeRoll.calculated[key] || 0) == value;
                    }, true);
                    return subSets;
                });
                _.each(arrRolls, function(subSets) {
                    candidates = _.groupBy(_.filter(backups, function(item) {
						//668 - 94 = 574 - 87 = 487
						var minCSP = statGroups[item.bucketType].max;
						
						console.log(item.bucketType, item.description, minCSP, item.getValue("MaxLight"));
                        return item.bucketType != mainPiece.bucketType && item.getValue("MaxLight") >= minCSP && ((item.tierType != 6 && mainPiece.tierType == 6) || (mainPiece.tierType != 6)) && mainPiece._id != item._id;
                    }), 'bucketType');
                    _.each(candidates, function(items) {
                        subSets.push(items);
                    });
					console.log(subSets);
					//abort;
                    var combos = tgd.cartesianProductOf(subSets);
                    var scoredCombos = _.map(combos, function(items) {
						/*var itms = _.map(items, function(item){
							item.activeRoll = (item.activeRoll && item.activeRoll.calculated) ? item.activeRoll.calculated : item.stats;
							return item;
						});*/
						console.log("pre", tgd.sum(tgd.joinStats(_.map(items, function(itm){ itm.activeRoll = itm.stats; return itm; }))));
						var itms = _.map(items, function(item){
							var currentLight = item.primaryStatValue();
							var targetBonus = tgd.bonusStatPoints(item.armorIndex, tgd.DestinyLightCap);
							var count = 0;
							//console.log("base rolls", item.rolls[0].base);
							var newStats = _.reduce(item.rolls[0].base, function(memo, baseStat, key, index){
								var newStat = baseStat * tgd.DestinyLightCap / currentLight;
								memo[key] = newStat + (count == 0 ? targetBonus : 0);
								count++;
								return memo;
							}, {});
							console.log("newStats", newStats, item.rolls[0].base, item.stats, item.getValue("MaxLight"));
							item.activeRoll = newStats;
							//item.activeRoll.isFutureRoll = 0;
							
							/*console.log("old-stats", item.stats);
							console.log("new-stats", newStats);
							abort;*/
							return item;
						});
                        var tmp = tgd.joinStats(itms);
						console.log("itms", itms);
						console.log("tmp", tmp);
						console.log("post", tgd.sum(tmp));
                        var result = {
                            set: itms,
                            score: tgd.sum(_.map(tmp, function(value, key) {
                                var result = Math.floor(value / tgd.DestinySkillTier);
                                return result > 5 ? 5 : result;
                            })) + (tgd.sum(tmp) / 1000)
                        };
						console.log(result);
						abort;
						return result;
                    });
                    var highestScore = Math.floor(_.max(_.pluck(scoredCombos, 'score')));
                    _.each(scoredCombos, function(combo) {
                        if (combo.score >= highestScore) {
                            bestSets.push(combo);
                        }
                    });
                });
            });
            var highestFinalScore = Math.floor(_.max(_.pluck(bestSets, 'score')));
            var lastSets = [];
            _.each(bestSets, function(combo) {
                if (combo.score >= highestFinalScore) {
                    lastSets.push(combo);
                }
            });
            callback(_.sortBy(lastSets, 'score'));
        });

    },
    findHighestItemBy: function(type, buckets, items) {
        var character = this;
        var sets = [];
        var backups = [];
        var primaryStats = {};
        var candidates;

        _.each(buckets, function(bucket) {
            candidates = _.filter(items, function(item) {
                return item.bucketType == bucket && item.equipRequiredLevel <= character.level() && item.canEquip === true && ((item.classType != 3 && tgd.DestinyClass[item.classType] == character.classType()) || (item.classType == 3 && item.armorIndex > -1) || (item.weaponIndex > -1)) && ((type == "All" && item.armorIndex > -1) || type != "All");
            });
            //console.log("bucket: " + bucket);
            //console.log(candidates);
            _.each(candidates, function(candidate) {
                if (type == "Light" || type == "All" || (type != "Light" && candidate.stats[type] > 0)) {
                    (candidate.tierType == 6 && candidate.hasLifeExotic === false ? sets : backups)[candidate.isEquipped() ? "unshift" : "push"]([candidate]);
                }
            });
        });

        backups = _.flatten(backups);

        //console.log("backups");
        //console.log(backups);

        _.each(_.groupBy(_.flatten(sets), 'bucketType'), function(items, bucketType) {
            primaryStats[bucketType] = _.max(_.map(items, function(item) {
                return item.getValue(type);
            }));
        });

        _.each(backups, function(spare) {
            //if the user has no exotics the sets array is empty and primaryStats is an empty object therefore maxCandidate should be 0 and not undefined
            var maxCandidate = primaryStats[spare.bucketType] || 0;
            if (maxCandidate < spare.getValue(type)) {
                //console.log("adding backup " + spare.description);
                sets.push([spare]);
            }
        });

        //console.log("sets");
        //console.log(sets);

        _.each(sets, function(set) {
            var main = set[0];
            //console.log("main set item " + main.description);

            _.each(buckets, function(bucket) {
                if (bucket != main.bucketType) {
                    candidates = _.where(backups, {
                        bucketType: bucket
                    });
                    tgd.localLog(candidates.length + " best candidate for bucket: " + bucket);
                    //console.log("candidates: " + _.pluck(candidates,'description'));
                    if (candidates.length > 0) {
                        primaryStats = _.map(candidates, function(item) {
                            return item.getValue(type);
                        });
                        //console.log(primaryStats);
                        var maxCandidate = _.max(primaryStats);
                        var candidate = candidates[primaryStats.indexOf(maxCandidate)];
                        //console.log("winner: " + candidate.description);
                        set.push(candidate);
                    }
                }
            });
        });
        var sumSets = _.map(sets, function(set) {
            return tgd.sum(_.map(set, function(item) {
                return item.getValue(type);
            }));
        });

        highestSetValue = _.max(sumSets);
        highestSet = _.sortBy(sets[sumSets.indexOf(highestSetValue)], function(item) {
            return item.tierType * -1;
        });
        return [highestSetValue, highestSet];
    },
    equipAction: function(type, highestSetValue, highestSet) {
        var character = this;

        $.toaster({
            priority: 'success',
            title: 'Result',
            message: " The highest set available for " + type + "  is  " + highestSetValue,
            settings: {
                timeout: 7 * 1000
            }
        });

        var count = 0;
        var done = function() {
            count++;
            if (count == highestSet.length) {
                var msa = adhoc.transfer(character.id, true);
                tgd.localLog(msa);
                adhoc.swapItems(msa, character.id, function() {
                    $.toaster({
                        settings: {
                            timeout: 7 * 1000
                        },
                        priority: 'success',
                        title: 'Result',
                        message: " Completed equipping the highest " + type + " set at " + highestSetValue
                    });
                    character.statsShowing(false);
                });
            }
        };
        //console.log(highestSet); abort;

        var adhoc = new tgd.Loadout();
        _.each(highestSet, function(candidate) {
            var itemEquipped = character.itemEquipped(candidate.bucketType);
            if (itemEquipped && itemEquipped._id && itemEquipped._id !== candidate._id) {
                var message;
                if ((type == "Light" && candidate.primaryStatValue() > itemEquipped.primaryStatValue()) || type != "Light") {
                    adhoc.addUniqueItem({
                        id: candidate._id,
                        bucketType: candidate.bucketType,
                        doEquip: true
                    });
                    message = candidate.bucketType + " can have a better item with " + candidate.description;
                    tgd.localLog(message);
                } else {
                    message = candidate.description + " skipped because the equipped item (" + itemEquipped.description + ") is equal or greater light";
                }
                $.toaster({
                    priority: 'info',
                    title: 'Equip',
                    message: message,
                    settings: {
                        timeout: tgd.defaults.toastTimeout
                    }
                });
                done();
            } else {
                done();
            }
        });
    },
    equipHighest: function(type) {
        var character = this;
        return function() {
            if (character.id == "Vault") return;

            var armor = [].concat(tgd.DestinyArmorPieces);
            var weapons = tgd.DestinyWeaponPieces;
            var items = _.flatten(_.map(app.characters(), function(avatar) {
                return avatar.items();
            }));

            var highestSet;
            var highestSetValue;
            var bestArmorSets;
            var bestWeaponSets;
            if (type == "Best" || type == "OptimizedBest") {
                var bestSets,
                    weaponsEquipped = _.filter(character.equippedGear(), function(item) {
                        return item.weaponIndex > -1;
                    }),
                    weaponTypes = _.map(app.weaponTypes(), function(type) {
                        return type.name.split(" ")[0];
                    }).concat(tgd.DestinyWeaponPieces);
                $("body").css("cursor", "progress");
                //console.time("best combo timer");
                setTimeout(function() {
                    /* Only consider Armor within your own character, and all Ghosts anywhere */
                    var activeItems = _.filter(items, function(item) {
                        return item.armorIndex > -1 && (item.bucketType == "Ghost" || (item.bucketType !== "Ghost" && item.characterId() == character.id));
                    });
                    if (type == "OptimizedBest") {
                        /* Only consider the top 2 items sorted by CSP of the results provided */
                        activeItems = _.reduce(_.groupBy(activeItems, 'bucketType'), function(memo, group) {
                            var sortedItems = _.sortBy(group, function(item) {
                                return item.getValue("All") * -1;
                            });
                            memo = memo.concat(_.first(sortedItems, 3));
                            return memo;
                        }, []);
                    }
                    character.findBestArmorSetV2(activeItems, function(bestSets) {
                        var highestTier = Math.floor(_.max(_.pluck(bestSets, 'score'))),
                            armorBuilds = {},
                            arrArmorBuilds = [];
                        _.each(bestSets, function(combo) {
                            if (combo.score >= highestTier) {
                                var statTiers = "",
                                    statValues = "",
                                    stats = tgd.joinStats(combo.set),
                                    sortedKeys = _.sortBy(_.keys(stats));
                                combo.stats = [];
                                _.each(sortedKeys, function(name) {
                                    statTiers = statTiers + " <strong>" + name.substring(0, 3) + "</strong> T" + Math.floor(stats[name] / tgd.DestinySkillTier);
                                    statValues = statValues + stats[name] + "/";
                                    combo.stats.push(stats[name]);
                                });
                                combo.light = character.calculatePowerLevelWithItems(combo.set.concat(weaponsEquipped));
                                combo.statTiers = $.trim(statTiers);
                                combo.statValues = statValues.substring(0, statValues.length - 1);
                                combo.perks = _.filter(
                                    _.flatten(
                                        _.map(combo.set, function(item) {
                                            return _.map(item.perks, function(perk) {
                                                perk.bucketType = item.bucketType;
                                                return perk;
                                            });
                                        })
                                    ),
                                    function(perk) {
                                        return (perk.active === true && perk.bucketType != "Class Items" && _.intersection(weaponTypes, perk.name.split(" ")).length > 0) || (perk.active === true && perk.bucketType == "Helmet" && perk.isExclusive == -1 && perk.isInherent === false);
                                    }
                                );
                                combo.similarityScore = _.values(_.countBy(_.map(_.filter(combo.perks, function(perk) {
                                    return perk.bucketType != "Class Items" && perk.bucketType != "Helmet";
                                }), function(perk) {
                                    return _.intersection(weaponTypes, perk.name.split(" "))[0];
                                })));
                                combo.similarityScore = (3 / combo.similarityScore.length) + tgd.sum(combo.similarityScore);
                                combo.hash = _.pluck(_.sortBy(combo.set, 'bucketType'), '_id').join(",");
                                combo.id = tgd.hashCode(combo.statTiers);
                                if (!(combo.statTiers in armorBuilds)) {
                                    armorBuilds[combo.statTiers] = [];
                                }
                                armorBuilds[combo.statTiers].push(combo);
                            }
                        });
                        _.each(armorBuilds, function(statTiers, key) {
                            var newTiers = _.reduce(statTiers, function(memo, combo) {
                                if (!_.findWhere(memo, {
                                        hash: combo.hash
                                    }))
                                    memo.push(combo);
                                return memo;
                            }, []);
                            arrArmorBuilds.push(_.first(_.sortBy(newTiers, function(combo) {
                                return [combo.similarityScore, combo.score];
                            }).reverse(), 200));
                        });
                        //reset armorBuilds so it doesn't take up memory after it's been transformed into an array
                        armorBuilds = {};

                        arrArmorBuilds = _.sortBy(arrArmorBuilds, function(builds) {
                            return _.max(_.pluck(builds, 'similarityScore')) * -1;
                        });

                        var renderTemplate = function(builds) {
                            var _template = $(tgd.armorTemplates({
                                builds: builds
                            }));
                            _template.find(".itemImage,.perkImage").bind("error", function() {
                                tgd.imageErrorHandler(this.src.replace(location.origin, '').replace("www/", ""), this)();
                            });
                            return _template;
                        }

                        var assignBindingHandlers = function() {
                            $("a.itemLink").each(function() {
                                var element = $(this);
                                var itemId = element.attr("itemId");
                                var instanceId = element.attr("instanceId");
                                element.click(false);
                                Hammer(element[0], {
                                    time: 2000
                                }).on("tap", function(ev) {
                                    $ZamTooltips.lastElement = element;
                                    $ZamTooltips.show("destinydb", "items", itemId, element);
                                }).on("press", function(ev) {
                                    var newArmorBuilds = _.map(_.filter(arrArmorBuilds, function(sets) {
                                        return _.filter(sets, function(combos) {
                                            return _.pluck(combos.set, '_id').indexOf(instanceId) > -1;
                                        }).length > 0;
                                    }), function(sets) {
                                        return _.filter(sets, function(combos) {
                                            return _.pluck(combos.set, '_id').indexOf(instanceId) > -1;
                                        });
                                    });
                                    armorTemplateDialog.content(renderTemplate(newArmorBuilds));
                                    setTimeout(assignBindingHandlers, 10);
                                });
                            });
                            $(".prevCombo").bind("click", function() {
                                var currentRow = $(this).parents(".row");
                                var currentId = currentRow.attr("id");
                                var newId = currentId.split("_")[0] + "_" + (parseInt(currentId.split("_")[1]) - 1);
                                currentRow.hide();
                                $("#" + newId).show();
                            });
                            $(".nextCombo").bind("click", function() {
                                var currentRow = $(this).parents(".row");
                                var currentId = currentRow.attr("id");
                                var newId = currentId.split("_")[0] + "_" + (parseInt(currentId.split("_")[1]) + 1);
                                currentRow.hide();
                                $("#" + newId).show();
                            });
                        }

                        var $template = renderTemplate(arrArmorBuilds);

                        var armorTemplateDialog = (new tgd.dialog({
                            buttons: [{
                                label: app.activeText().movepopup_equip,
                                action: function(dialog) {
                                    if ($("input.armorBuild:checked").length === 0) {
                                        BootstrapDialog.alert("Error: Please select one armor build to equip.");
                                    } else {
                                        var selectedBuild = $("input.armorBuild:checked").val();
                                        var selectedStatTier = selectedBuild.split("_")[0];
                                        var selectedIndex = selectedBuild.split("_")[1];
                                        highestCombo = _.filter(arrArmorBuilds, function(sets) {
                                            return sets[0].statTiers == selectedStatTier
                                        })[0][selectedIndex];
                                        character.equipAction(type, highestCombo.score.toFixed(3), highestCombo.set);
                                        dialog.close();
                                    }
                                }
                            }, {
                                label: app.activeText().cancel,
                                action: function(dialog) {
                                    dialog.close();
                                }
                            }]
                        })).title("Armor Build" + (arrArmorBuilds.length > 1 ? "s" : "") + " Found for Tier " + highestTier).content($template).show(true, function() {
                            armorBuilds = null;
                            arrArmorBuilds = null;
                        }, function() {
                            assignBindingHandlers();
                        });
                        //console.timeEnd("best combo timer");
                        $("body").css("cursor", "default");
                    });
                }, 300);
            } else if (type == "Light") {
                bestArmorSets = character.findHighestItemBy("Light", armor, items)[1];
                tgd.localLog("bestArmorSets: " + _.pluck(bestArmorSets, 'description'));
                bestWeaponSets = character.findHighestItemBy("Light", weapons, items)[1];
                tgd.localLog("bestWeaponSets: " + _.pluck(bestWeaponSets, 'description'));
                highestSet = bestArmorSets.concat(bestWeaponSets);
                tgd.localLog("highestSet: " + _.pluck(highestSet, 'description'));
                highestSetValue = character.calculatePowerLevelWithItems(highestSet);
                character.equipAction(type, highestSetValue, highestSet);
            } else if (type == "All") {
                bestArmorSets = character.findHighestItemBy("All", armor, items);
                tgd.localLog("bestArmorSets: " + _.pluck(bestArmorSets, 'description'));
                highestSet = bestArmorSets[1];
                highestSetValue = bestArmorSets[0];
                character.equipAction(type, highestSetValue, highestSet);
            } else {
                bestArmorSets = character.findHighestItemBy(type, armor, items);
                if (bestArmorSets[0] < tgd.DestinySkillCap) {
                    highestSetValue = bestArmorSets[0];
                    highestSet = bestArmorSets[1];
                } else {
                    bestArmorSets = character.reduceMaxSkill(type, armor, items);
                    highestSetValue = bestArmorSets[0];
                    highestSet = bestArmorSets[1];
                }
                character.equipAction(type, highestSetValue, highestSet);
            }

        };
    }
};