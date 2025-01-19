const crypto = require('crypto');
const Table = require('cli-table3');
const readline = require('readline');

let chalk;
(async () => {
    chalk = (await import('chalk')).default;
})();


class SecureRandom {
    static generateKey(length = 32){
        return crypto.randomBytes(length).toString('hex');
    }

    static generateRandomInteger(range){
        if (range <= 0){
            throw new Error('Range must be a positive integer.');
        }
        const randomBuffer = crypto.randomBytes(4);
        const randomValue = randomBuffer.readUInt32BE(0);
        return randomValue % range;
    }

    static calculateHMAC(key, message) {
        return crypto.createHmac('sha3-256', key).update(message.toString()).digest('hex');
    }
}

class Dice {
    constructor(values){
        if(!Array.isArray(values) || values.length !== 6 || !values.every(Number.isInteger)){
            throw new Error('Each dice must have exactly six integer values.');
        }
        if(values.some(value => value < 0)){
            throw new Error('Dice values must be non-negative integers.');
        }
        this.values = values;
    }

    roll(index){
        if(index < 0 || index >= this.values.length){
            throw new Error('Roll index must be between 0 and 5.');
        }
        return this.values[index];
    }

    graphicalRoll(index) {
        const rollValue = this.roll(index);
        console.log((chalk ? chalk.blue.bold(`+---+\n| ${rollValue.toString().padEnd(2)}|\n+---+`) : `+---+\n| ${rollValue.toString().padEnd(2)}|\n+---+`));
        return rollValue;
    }
    
}

class Probability {
    static calculateProbabilities(diceArray){
        const probabilities = Array(diceArray.length).fill(0).map(() => Array(diceArray.length).fill(0));
        for(let i = 0; i < diceArray.length; i++){
            for(let j = 0; j < diceArray.length; j++){
                if(i === j) continue;
                let winCount = 0;
                for(let x = 0; x < 6; x++){
                    for(let y = 0; y < 6; y++){
                        if(diceArray[i].roll(x) > diceArray[j].roll(y)){
                            winCount++;
                        }
                    }
                }
                probabilities[i][j] = (winCount / 36 ).toFixed(4);
            }
        }
        return probabilities;
    }
}

class ProbabilityTable {
    static display(diceArray, probabilities){
        const table = new Table({
            head: ['', ...diceArray.map((_, index) => `Dice ${index + 1}`)],
            colWidths: [15, ...Array(diceArray.length).fill(12)]
        });

        probabilities.forEach((row, i) => {
            table.push([
                `Dice ${i + 1}`,
                ...row.map((prob, j) => (i === j ? '-' : prob))
            ]);
        });

        console.log('\nProbability of winning:');
        console.log(table.toString());
    }
}

class Game {
    constructor(diceArgs){
        this.validateArgs(diceArgs);
        this.diceArray = diceArgs.map(arg => new Dice(arg.split(',').map(Number)));
    }

    validateArgs(args) {
        if (!Array.isArray(args) || args.length < 3) {
            throw new Error('You must specify at least 3 dice configurations.');
        }
        args.forEach(arg => {
            if (!/^(\d+,){5}\d+$/.test(arg)) {
                throw new Error('Each dice must be a comma-separated list of six integers.');
            }
        });
    }
    

    async play() {
        console.log('Welcome to the Non-Transitive Dice Game!');
        const probabilities = Probability.calculateProbabilities(this.diceArray);

        while(true){
            console.log('\nMain Menu:');
            console.log('1. Play game');
            console.log('2. View Probabilities');
            console.log('3. Exit');

            const choice = await this.getUserInput('Choose an option: ');

            switch(choice){
                case '1':
                    await this.startGame();
                    break;
                case '2':
                    ProbabilityTable.display(this.diceArray, probabilities);
                    continue;
                case '3':
                    console.log('Goodbye!');
                    return;
                default:
                    console.log('Invalid option. Try again.');
            }
        }
    }

    async startGame(){
        console.log('\nSelect difficulty level:');
        console.log('1. Easy (random dice selection)');
        console.log('2. Medium (based on probabilites)');
        const difficulty = await this.getUserInput('Choose difficulty (1 or 2): ');

        if(!['1', '2'].includes(difficulty)){
            console.log('Invalid difficulty choice. Defaulting to Easy.');
        }

        this.difficulty = difficulty === '2' ? 'medium' : 'easy';

        const key = SecureRandom.generateKey();
        const computerChoice = SecureRandom.generateRandomInteger(2);
        const hmac = SecureRandom.calculateHMAC(key, computerChoice);
        console.log(`\nComputer has generated a choice with HMAC: ${hmac}\n`);

        const userGuess = await this.getUserInput('Guess the computer\'s choice (0 or 1): ');

        if(!['0', '1'].includes(userGuess)){
            console.log('Invalid choice. Please enter 0 or 1.');
            return await this.startGame();
        }

        if (Number(userGuess) === this.computerChoice) {
            console.log(`\nYou guessed correctly! You make the first move. The key was: ${key} and message: ${computerChoice}\n`);
            await this.userMoveFirst();
        } else {
            console.log(`\nYou guessed wrong. Computer makes the first move. The key was: ${key} and message: ${computerChoice}\n`);
            await this.computerMoveFirst();
        }
    }

    async userMoveFirst(){
        const userDice = await this.selectDice('Select your dice:');
        const computerDice = this.selectComputerDice(userDice);

        console.log(`Computer selected dice: [${computerDice.values.join(',')}]`);
        await this.playTurns(userDice, computerDice);
    }

    async computerMoveFirst() {
        const computerDice = this.selectComputerDice();
        if (!computerDice) {
            console.error('Error: Computer could not select a valid dice. Please restart the game.');
            process.exit(1);
        }
    
        console.log(`Computer selected dice: [${computerDice.values.join(',')}]`);
    
        const userDice = await this.selectDice('Select your dice (excluding computer\'s choice):');
        await this.playTurns(userDice, computerDice);
    }
    
    async playTurns(userDice, computerDice) {
        console.log('\nIt\'s time for my throw.');
    
        const computerKey1 = SecureRandom.generateKey();
        const computerRollIndex1 = SecureRandom.generateRandomInteger(6);
        const computerHMAC1 = SecureRandom.calculateHMAC(computerKey1, computerRollIndex1);
    
        console.log(`I selected a random value in the range 0..5 (HMAC=${computerHMAC1}).`);
    
        const userThrow1 = await this.getUserInput('\nAdd your number modulo 6.\n0 - 0\n1 - 1\n2 - 2\n3 - 3\n4 - 4\n5 - 5\nX - exit\n? - help\nYour selection: ');
    
        if (!['0', '1', '2', '3', '4', '5'].includes(userThrow1)) {
            console.log('\nInvalid input. Please select a number between 0 and 5.\n');
            return await this.playTurns(userDice, computerDice);
        }
    
        console.log(`\nMy number is ${computerRollIndex1} (KEY=${computerKey1}).`);
    
        const result1 = (Number(userThrow1) + computerRollIndex1) % 6;
        console.log(`The result is ${computerRollIndex1} + ${userThrow1} = ${result1} (mod 6).`);
    
        console.log('\nComputer rolled:\n');
        const computerRoll = await computerDice.graphicalRoll(result1);
    
        console.log('\nNow it\'s your turn.');

        const computerKey2 = SecureRandom.generateKey();
        const computerRollIndex2 = SecureRandom.generateRandomInteger(6);
        const computerHMAC2 = SecureRandom.calculateHMAC(computerKey2, computerRollIndex2);
    
        console.log(`I selected a random value in the range 0..5 (HMAC=${computerHMAC2}).`);
    
        const userThrow2 = await this.getUserInput('\nAdd your number modulo 6.\n0 - 0\n1 - 1\n2 - 2\n3 - 3\n4 - 4\n5 - 5\nX - exit\n? - help\nYour selection: ');
    
        if (!['0', '1', '2', '3', '4', '5'].includes(userThrow2)) {
            console.log('\nInvalid input. Please select a number between 0 and 5.\n');
            return await this.playTurns(userDice, computerDice);
        }
    
        console.log(`\nMy number is ${computerRollIndex2} (KEY=${computerKey2}).`);
    
        const result2 = (Number(userThrow2) + computerRollIndex2) % 6;
        console.log(`The result is ${computerRollIndex2} + ${userThrow2} = ${result2} (mod 6).`);
    
        console.log('\nYou rolled:\n');
        const userDiceRoll = await userDice.graphicalRoll(result2);
    
        if (userDiceRoll > computerRoll) {
            console.log('\nYou win!\n');
        } else {
            console.log('\nComputer wins!\n');
        }
    }
    
    selectComputerDice(excludeDice = null) {
        if (this.difficulty === 'medium') {
            const probabilities = Probability.calculateProbabilities(this.diceArray);
            const excludeIndex = this.diceArray.indexOf(excludeDice);
    
            let bestDice = null;
            let bestProbability = -1;
    
            this.diceArray.forEach((dice, index) => {
                if (index !== excludeIndex) {
                    const winProbability = probabilities[index][excludeIndex] || 0;
                    if (winProbability > bestProbability) {
                        bestProbability = winProbability;
                        bestDice = dice;
                    }
                }
            });
    
            if (!bestDice) {
                const availableDice = this.diceArray.filter(dice => dice !== excludeDice);
                bestDice = availableDice[SecureRandom.generateRandomInteger(availableDice.length)];
            }
    
            return bestDice;
        }
    
        const availableDice = this.diceArray.filter(dice => dice !== excludeDice);
        return availableDice[SecureRandom.generateRandomInteger(availableDice.length)];
    }
    
    async selectDice(promt){
        console.log(promt);
        this.diceArray.forEach((dice, index) => console.log(`${index + 1}: [${dice.values.join(',')}]`));
        const choice = await this.getUserInput('Your choice: ');

        if(!/^[1-9]\d*$/.test(choice) || Number(choice) < 1 || Number(choice) > this.diceArray.length){
            console.log('Invalid selection. Please choose a valid dice number.');
            return await this.selectDice(promt);
        }

        return this.diceArray[Number(choice) - 1];
    }

    getUserInput(promt){
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        return new Promise(resolve => rl.question(promt, answer => {
            rl.close();
            resolve(answer.trim());
        }));
    }
}

const args = process.argv.slice(2);

if(args.length < 3){
    console.error('Error: You must specify at least 3 dice configurations.');
    console.error('Example: node DiceGame.js "2,2,4,4,9,9" "6,8,1,1,8,6" "7,5,3,7,5,3"');
    process.exit(1);
}

try{
    const game = new Game(args);
    game.play();
} catch (error){
    console.error(`Error: ${error.message}`);
}