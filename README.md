# What is GTM-CLEANER tool?
The tool has been made to automate the process of cleaning a GTM container. Currently it is capable of these actions:

- remove unused variables
- remove unused triggers
- delete all the console logs from variables and tags

# How to use the tool?
1. Export a GTM container JSON file from the google tag manager (admin -> export container)
2. Run the index.html file from the repository
3. Upload the exported JSON file
4. Select desired actions and press "UPLOAD" button
5. Download the updated JSON file
6. Import the JSON file back into GTM (admin -> import container)
