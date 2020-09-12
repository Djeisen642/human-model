# Human Model Project
This a model of a group of people.
It's going to be simplistic.
It's going to have assumptions.
Don't take it seriously.
Feel free to fork and add your own assumptions.

People can learn, have jobs, lie, steal, kill, and have children in this simulation.

The simulation will be on a yearly basis. Every action or event that a person takes part in
happens over the course of a year. No events within a year impact other events within the same year.

It's also an attempt at trying out typescript and test driven-development.

## Events and Actions
* Lying - changes intent in specific others
* Stealing - resources are taken from one person and given to another
* Learning - intelligence is increased, some happiness is added
* Killing - A person may kill another person. This causes death of the other person.
* Gathering resources - resources are added, happiness is added to a limit
* Exercising - constitution is added, some happiness is added
* Misfortune - death by natural disaster, suicide, loss of resources, or illness
* Windfall - further resources are added, some happiness is removed at some probability
* Invention - changes intent in society
* Created Relationship - a person may end up in a relationship with someone
* Had Child - if two people are in a relationship, then a child is born
* Lose/Gain Job - a person may lose or gain a job
* Graduate - a person that is working on some form of education may graduate

## Individual Properties
* hasJob {Boolean} - whether the person currently has a job
* education {String} - 'none', 'highschool', 'tradeschool', 'bachelors', 'masters', 'phd'
* isWorkingOnEd {String} - 'none', 'highschool', 'tradeschool', 'bachelors', 'masters', 'phd'
* helpsPeople {String} - 'police', 'medical', 'education', 'research' i.e. in what capacity does this person help
* killed {Set\<String\>} - list of people killed by person
* amountStolen {Map\<String, Number\>} - Maps people stolen from to the amount stolen
* peopleLiedTo {Set\<String\>} - list of people that have been lied to
* isInRelationshipWith {String} - determines whether a person is in a relationship
and tracks who this person might have a child with
* hasChildren {String[]} - keeps track of the relationships with children
* childOf {String[]} - Maps to the biological parents
* age {Number} - the current age of the person, stops incrementing at death
* illness {Number} - severity of illness from 1 to 10, causes loss of resources
and constitution and increases possibility of death
* causeOfDeath {String} - stores the cause of the person's death

## Stats (A type of individual property)
* resources {Number}
* experience {Number}
* intelligence {Number}
* constitution {Number}
* charisma {Number}
* happiness {Number}

### Resources
This should encompass the cars, the houses, and the money that a person has.
It can be lost due to misfortune; it can be gained due to a windfall;
it can be stolen; it can be given.

The seed starts with a bunch of people that have a random amount of it.
As people keep their jobs, they get more of it depending on their skill and intelligence.
When people are born, a certain amount of the resources of the parent is removed and
a certain amount is given to the child.

### Experience
As people get and keep a job, they gain more experience.
It helps to determine how many units of resources per year a person gets.
It can also stave off liars.
If a person has the helpsPeople property, then experience will determine how much they help.

### Intelligence
This also helps to determine how many units of resources per year a person gets.
The more intelligent a person is the more resources they gain.
The more intelligent a person is the more likely they are to make a discovery
that increases or decreases certain opportunities to others.
For example, the invention of the television allows people with high charisma to be
able to reach more people. This increases societal happiness but might decrease the possibility
that people might gain intelligence.

Intelligence also affects the probabilities of whether a person will have children
when in a relationship.

### Constitution
People can determine whether they want to exercise every year.
If they do, then they gain constitution. Constitution is the stat that helps 
defend against illness.

### Charisma
Intelligence requires charisma for an invention to have influence.
If a person lies, charisma is the stat that helps determine how many people that person lies to.

### Happiness
This just reduces the probability of suicide.

## Intent (Another type of individual property)
* learningIntent {Number}
* exerciseIntent {Number}
* stealingIntent {Number}
* lyingIntent {Number}
* killingIntent {Number}