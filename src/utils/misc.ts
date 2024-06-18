import { bot } from '../config'
import fs from 'fs'

export const createDirectoryIfNotExists = async (directory: string) => {
    try {
        await fs.promises.access(directory)
    } catch (error) {
        console.log(`Creating directory ${directory}`)
        await fs.promises.mkdir(directory, { recursive: true })
    }
}

export const getLocalVersion = () => {
    try {
        const packageJsonPath = './package.json'
        const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8')
        const packageJson = JSON.parse(packageJsonContent)
        return packageJson.version as string
    } catch (error) {
        if (error instanceof SyntaxError) {
            console.error('Error reading local package.json:', error.message)
        } else {
            console.error('Other error occurred:', error)
        }
        return null
    }
}

export const spinText = (text: string) => {
    const pattern = /\{([^{}]+)\}/g

    while (pattern.test(text)) {
        text = text.replace(pattern, (match, p1) => {
            const options = p1.split('|')
            const randomIndex = Math.floor(Math.random() * options.length)
            return options[randomIndex]
        })
    }

    return text
}

export const capitalize = (str: string): string => {
    if (!str) return str
    return str.charAt(0).toUpperCase() + str.slice(1)
}

// Check if message has a valid prefix
export const hasValidPrefix = (body: string) => {
    return bot.prefixes.includes(body.trim()[0])
}