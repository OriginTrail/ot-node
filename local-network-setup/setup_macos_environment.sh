#!/bin/sh
pathToOtNode=$(cd .. && pwd)

osascript -e "
  tell app \"Terminal\"
      do script \"cd $pathToOtNode && node index.js 8900 9000 ./local-network-setup/.bootstrap_origintrail_noderc\"
  end tell
  "

osascript -e "
  tell app \"Terminal\"
      do script \"cd $pathToOtNode && node index.js 8901 9001 ./local-network-setup/.dh_origintrail_noderc\"
  end tell
  "

osascript -e "
  tell app \"Terminal\"
      do script \"cd $pathToOtNode && node index.js 8902 9002 ./local-network-setup/.dh_origintrail_noderc\"
  end tell
  "

osascript -e "
  tell app \"Terminal\"
      do script \"cd $pathToOtNode && node index.js 8903 9003 ./local-network-setup/.dh_origintrail_noderc\"
  end tell
  "
