import { useNavigation } from "@react-navigation/native";
import { useGT } from "gt-react-native";
import { View } from "react-native";

import { Button } from "../../components/ui/Button";

export function TaskBoardEntry() {
  const gt = useGT();
  const navigation = useNavigation();
  return (
    <View className="items-start px-3 py-2">
      <Button
        tone="secondary"
        size="compact"
        label={gt("Task Board")}
        onPress={() => navigation.navigate("TaskBoard")}
      />
    </View>
  );
}
